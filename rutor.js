/**
 * Rutor plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2018 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('showtime/page');
var service = require('showtime/service');
var settings = require('showtime/settings');
var http = require('showtime/http');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;

RichText = function(x) {
    this.str = x.toString();
}

RichText.prototype.toRichString = function(x) {
    return this.str;
}

var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';
function colorStr(str, color) {
    return '<font color="' + color + '"> (' + str + ')</font>';
}

function coloredStr(str, color) {
    return '<font color="' + color + '">' + str + '</font>';
}

function setPageHeader(page, title) {
    if (page.metadata) {
        page.metadata.title = new RichText(title);
        page.metadata.logo = logo;
    }
    page.type = "directory";
    page.contents = "items";
    page.loading = false;
}

service.create(plugin.title, plugin.id + ":start", 'video', true, logo);

settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createString('baseURL', "Base URL without '/' at the end", 'http://rutor.is', function(v) {
    service.baseURL = v;
});

new page.Route(plugin.id + ":indexImages:(.*):(.*)", function(page, url, title) {
    page.model.contents = 'grid';
    setPageHeader(page, unescape(title));
    page.loading = true;
    var doc = http.request(service.baseURL + unescape(url)).toString();
    try {
        doc = doc.match(/<table id="details">([\s\S]*?)<td class="header">Оценка</)[1];
        var re = /<img src="([\s\S]*?)"/g;
        var match = re.exec(doc);
        while (match) {
            page.appendItem(match[1], 'image'); 
            match = re.exec(doc);
        }
    } catch(err) {}
    page.loading = false;
});

new page.Route(plugin.id + ":indexItem:(.*):(.*):(.*)", function(page, torrentUrl, infoUrl, title) {
    setPageHeader(page, unescape(title));
    page.loading = true;
    var doc = http.request(service.baseURL + unescape(infoUrl)).toString();
    var icon = description = void(0);

    try {
        var details = doc.match(/<table id="details">([\s\S]*?)<\/table>/)[1];
        icon = details.match(/<img src="([\s\S]*?)"/)[1];
        var expressions = [/О фильме:[\S\s]*?>([\S\s]*?)<a/, /Описание:[\S\s]*?>([\S\s]*?)<a/, /Описание[\S\s]*?>([\S\s]*?)<a/,
            /О сериале:[\S\s]*?>([\S\s]*?)<a/, /О фильме[\S\s]*?>([\S\s]*?)<a/, /Содержание:[\S\s]*?>([\S\s]*?)<a/];
        for (var i = 0 ; i < expressions.length; i++) {
            description = details.match(expressions[i]);
            if (description) {
                description = description[1].replace(/<br \/>/g, '').trim();
                break;
            }
        }
    } catch(err) {}

    page.metadata.logo = icon;
    var source = doc.match(/<td class="header">Залил<\/td>[\S\s]*?">([\S\s]*?)<\/a>/);
    var raiting = doc.match(/<td class="header">Оценка<\/td><td>([\S\s]*?) из/);
    var screenshots = doc.match(/Скриншоты([\S\s]*?)(<\/textarea>|<td class="header">)/);
    var backdrops = [];
    if (screenshots) {
        re = /<img src="([\s\S]*?)"/g;
        match = re.exec(screenshots[1]);
        while (match) {
            backdrops.push({url: match[1]});
            match = re.exec(screenshots[1]);
        }
    }
    page.appendItem('torrent:browse:' + unescape(torrentUrl), 'video', {
        title: new RichText(unescape(title)),
        icon: icon,
        backdrops: backdrops,
        source: source ? new RichText('Добавил: ' + coloredStr(source[1], orange)) : void(0),
        genre: new RichText(doc.match(/<td class="header">Категория<[\S\s]*?">([\S\s]*?)<\/a>/)[1] +
            '<br>Раздают: ' + coloredStr(doc.match(/<td class="header">Раздают<\/td><td>([\S\s]*?)<\/td>/)[1], green) +
            ' Качают: ' + coloredStr(doc.match(/<td class="header">Качают<\/td><td>([\S\s]*?)<\/td>/)[1], red) +
            '<br>Размер: ' + doc.match(/<td class="header">Размер<\/td><td>([\S\s]*?)<\/td>/)[1]),
        rating: raiting ? 10 * raiting[1] : void(0),
        tagline: new RichText(coloredStr('Добавлен: ', orange) + doc.match(/<td class="header">Добавлен<\/td><td>([\S\s]*?)<\/td>/)[1]),
        description: description ? new RichText(description) : void(0)
    });
    if (icon)
        page.appendItem(plugin.id + ':indexImages:' + infoUrl + ':' + title, 'directory', {
            title: 'Картинки',
            icon: icon
        }); 
    scraper(page, details, true);

    //1-nick, 2-date, 3-comment
    re = /class="c_h"><td><b>([\s\S]*?)<\/b><\/td>[\s\S]*?<td>([\s\S]*?)<\/td>[\s\S]*?class="c_t"[\s\S]*?>([\s\S]*?)<\/td>/g;
    match = re.exec(doc);
    var first = true;
    while (match) {
        if (first) {
            page.appendItem("", "separator", {
                title: 'Комментарии'
            });
            first = false;
        }        
        page.appendPassiveItem('video', '', {
            title: new RichText(coloredStr(match[1], orange) + ' ' + match[2]),
            tagline: match[2],
            description: new RichText(match[3])
        });
        match = re.exec(doc);
    }
    page.loading = false;
});

function scraper(page, doc, section) {
    // 1-date, 2-filelink, 3-infolink, 4-title, 5-(1)size, (2)seeds, (3)peers
    var re = /<tr class="[gai|tum]+"><td>([\s\S]*?)<\/td>[\s\S]*?href="([\s\S]*?)"[\s\S]*?<a href[\s\S]*?<a href="([\s\S]*?)">([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/g;
    var match = re.exec(doc);
    while (match) {
        var comments = '';
        if (match[5].match(/alt="C"/)) {
            var end = match[5].match(/[\s\S]*?<td align="right">[\s\S]*?<td align="right">([\s\S]*?)<[\s\S]*?nbsp;([\s\S]*?)<\/span>[\s\S]*?nbsp;([\s\S]*?)<\/span>/);
            comments = match[5].match(/[\s\S]*?<td align="right">([\s\S]*?)</)[1];
        } else
            var end = match[5].match(/[\s\S]*?<td align="right">([\s\S]*?)<[\s\S]*?nbsp;([\s\S]*?)<\/span>[\s\S]*?nbsp;([\s\S]*?)<\/span>/);
        var url = service.baseURL + match[2];
        if (match[2].match(/http:\/\//))
            url = service.baseURL + match[2].match(/(\/download.*)/)[1];
        if (section && page.entries == 0)
            page.appendItem("", "separator", {
                title: 'Связанные раздачи'
            });
        page.appendItem(plugin.id + ':indexItem:' + escape(url) + ':' + escape(match[3]) + ':' + escape(match[4]), 'directory', {
            title: new RichText(colorStr(match[1], orange) + ' ' +
                match[4] + ' ('+ coloredStr(end[2], green) + '/'+
                coloredStr(end[3], red) + ') ' + colorStr(end[1], blue) +
                (comments ? colorStr(comments, orange) : ''))
        }); 
        page.entries++;
        match = re.exec(doc);
    }
}

new page.Route(plugin.id + ":browse:(.*):(.*)", function(page, url, title) {
    setPageHeader(page, plugin.synopsis + ' / ' + unescape(title));
    page.loading = true;
    page.entries = 0;
    var tryToSearch = true;
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var doc = http.request(service.baseURL + url).toString();
	page.loading = false;
        scraper(page, doc);
        var more = doc.match(/nbsp;<a href="([\s\S]*?)"><b>След.&nbsp/);
	if (!more) return tryToSearch = false;
        url = more[1];
        return true;
    };
    loader();
    page.paginator = loader;
});

var html = 0;
new page.Route(plugin.id + ":categories", function(page) {
    setPageHeader(page, plugin.title + ' - Категории');
    page.loading = true;
    if (!html) 
        html = http.request(service.baseURL + '/top').toString();
    var re = /Самые популярные торренты в категории <a href=([\s\S]*?)>([\s\S]*?)<\/a>/g;
    var match = re.exec(html);
    while (match) {
        var name = match[2].replace(/"/g, '').trim();
        page.appendItem(plugin.id + ':browse:' + match[1] + ':' + escape(name), 'directory', {
            title: name
        });
        match = re.exec(html);
    }
    page.loading = false;
});

new page.Route(plugin.id + ":start", function(page) {
    setPageHeader(page, plugin.synopsis);
    page.loading = true;

    page.appendItem(plugin.id + ":search:", 'search', {
        title: 'Поиск на ' + service.baseURL
    });

    html = http.request(service.baseURL + '/top').toString();

    page.appendItem(plugin.id + ":categories:", 'directory', {
        title: 'Категории'
    });

    var doc = html.match(/<div id="index">([\s\S]*?)<!-- bottom banner -->/);
    if (doc) {
        var re = /<h2>([\s\S]*?)<\/h2>([\s\S]*?)<\/table>/g;
        var match = re.exec(doc[1]);
        while (match) {
            page.appendItem("", "separator", {
                title: new RichText(match[1])
            });
            scraper(page, match[2]);
            var more = match[1].match(/<a href=([\s\S]*?)>([\s\S]*?)<\/a>/);
            if (more) {
                page.appendItem(plugin.id + ':browse:' + more[1] + ':' + escape(more[2]), 'directory', {
                    title: 'Больше ►'
                });                   
            }
            match = re.exec(doc[1]);
        }
    }
    page.loading = false;
});

function search(page, query) {
    setPageHeader(page, plugin.title);
    page.entries = 0;
    var fromPage = 0, tryToSearch = true;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
	var doc = http.request(service.baseURL + "/search/"+ fromPage +"/0/000/0/" + query.replace(/\s/g, '\+')).toString();
	page.loading = false;
        scraper(page, doc);
	if (!doc.match(/downgif/)) return tryToSearch = false;
        fromPage++;
	return true;
    };
    loader();
    page.paginator = loader;
}

new page.Route(plugin.id + ":search:(.*)", function(page, query) {
    search(page, query);
});

page.Searcher(plugin.id, logo, function(page, query) {
    search(page, query);
});
