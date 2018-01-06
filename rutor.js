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
        page.metadata.title = title;
        page.metadata.logo = logo;
    }
    page.type = "directory";
    page.contents = "items";
    page.loading = false;
}

service.create(plugin.title, plugin.id + ":start", 'video', true, logo);

settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createString('baseURL', "Base URL without '/' at the end", 'http://rutor.info', function(v) {
    service.baseURL = v;
});

function scraper(page, doc) {
    // 1-date, 2-filelink, 3-infolink, 4-title, 5-(1)size, (2)seeds, (3)peers
    var re = /<tr class="[gai|tum]+"><td>([\s\S]*?)<\/td>[\s\S]*?href="([\s\S]*?)"[\s\S]*?<a href[\s\S]*?<a href="([\s\S]*?)">([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/g;
    var match = re.exec(doc);
    while (match) {
        if (match[5].match(/alt="C"/)) {
            var end = match[5].match(/[\s\S]*?<td align="right">[\s\S]*?<td align="right">([\s\S]*?)<[\s\S]*?nbsp;([\s\S]*?)<\/span>[\s\S]*?nbsp;([\s\S]*?)<\/span>/);
            var comments = match[5].match(/[\s\S]*?<td align="right">([\s\S]*?)</)[1];
        } else
            var end = match[5].match(/[\s\S]*?<td align="right">([\s\S]*?)<[\s\S]*?nbsp;([\s\S]*?)<\/span>[\s\S]*?nbsp;([\s\S]*?)<\/span>/);
        var url = service.baseURL + match[2];
        if (match[2].match(/http:\/\//))
            url = service.baseURL + match[2].match(/(\/download.*)/)[1];
        page.appendItem('torrent:browse:' + url, 'directory', {
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

new page.Route(plugin.id + ":start", function(page) {
    setPageHeader(page, plugin.synopsis);
    page.appendItem(plugin.id + ":search:", 'search', {
        title: 'Поиск на ' + service.baseURL
    });
    page.loading = true;
    var doc = http.request(service.baseURL + '/top').toString();
    doc = doc.match(/<div id="index">([\s\S]*?)<!-- bottom banner -->/);
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
    setPageHeader(page, plugin.synopsis + ' / ' + query);
    search(page, query);
});

page.Searcher(plugin.id, logo, function(page, query) {
    search(page, query);
});
