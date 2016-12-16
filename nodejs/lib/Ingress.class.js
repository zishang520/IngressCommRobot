(function() {
    'use strict';

    // 内置对象
    var request = require('request'),
        Conffs = require(__dirname + '/Config.class.js'),
        FileCookieStore = require('tough-cookie-filestore'),
        Sqlite3 = require("sqlite3").verbose();

    // 内置函数
    var parse_url = function(str, component) {

            var key = ["source", "scheme", "authority", "userInfo", "user", "pass", "host", "port", "relative", "path", "directory", "file", "query", "fragment"],
                m = new RegExp(['(?:([^:\\/?#]+):)?', '(?:\\/\\/()(?:(?:()(?:([^:@\\/]*):?([^:@\\/]*))?@)?([^:\\/?#]*)(?::(\\d*))?))?', '()', '(?:(()(?:(?:[^?#\\/]*\\/)*)()(?:[^?#]*))(?:\\?([^#]*))?(?:#(.*))?)'].join('')).exec(str),
                uri = {},
                i = 14;

            while (i--) {
                if (m[i]) {
                    uri[key[i]] = m[i];
                }
            }

            if (component) {
                return uri[component.replace('PHP_URL_', '').toLowerCase()];
            }

            delete uri.source;
            return uri;
        },
        http_build_query = function(formdata, numericPrefix, argSeparator) {

            var urlencode = function(str) {
                str = (str + '');
                return encodeURIComponent(str)
                    .replace(/!/g, '%21')
                    .replace(/'/g, '%27')
                    .replace(/\(/g, '%28')
                    .replace(/\)/g, '%29')
                    .replace(/\*/g, '%2A')
                    .replace(/%20/g, '+');
            };

            var value,
                key,
                tmp = [];

            var _httpBuildQueryHelper = function(key, val, argSeparator) {
                var k;
                var tmp = [];
                if (val === true) {
                    val = '1';
                } else if (val === false) {
                    val = '0';
                }
                if (val !== null) {
                    if (typeof val === 'object') {
                        for (k in val) {
                            if (val[k] !== null) {
                                tmp.push(_httpBuildQueryHelper(key + '[' + k + ']', val[k], argSeparator));
                            }
                        }
                        return tmp.join(argSeparator);
                    } else if (typeof val !== 'function') {
                        return urlencode(key) + '=' + urlencode(val);
                    } else {
                        throw new Error('There was an error processing for http_build_query().');
                    }
                } else {
                    return '';
                }
            };

            if (!argSeparator) {
                argSeparator = '&';
            }
            for (key in formdata) {
                value = formdata[key];
                if (numericPrefix && !isNaN(key)) {
                    key = String(numericPrefix) + key;
                }
                var query = _httpBuildQueryHelper(key, value, argSeparator);
                if (query !== '') {
                    tmp.push(query);
                }
            }

            return tmp.join(argSeparator);
        },
        is_scalar = function(value) {
            return (/boolean|number|string/).test(typeof value);
        },
        merge = function() {
            var args = Array.prototype.slice.call(arguments),
                argl = args.length,
                arg,
                retObj = {},
                k = '',
                argil = 0,
                j = 0,
                i = 0,
                ct = 0,
                toStr = Object.prototype.toString,
                retArr = true;
            for (i = 0; i < argl; i++) {
                if (toStr.call(args[i]) !== '[object Array]') {
                    retArr = false;
                    break;
                }
            }

            if (retArr) {
                retArr = [];
                for (i = 0; i < argl; i++) {
                    retArr = retArr.concat(args[i]);
                }
                return retArr;
            }

            for (i = 0, ct = 0; i < argl; i++) {
                arg = args[i];
                if (toStr.call(arg) === '[object Array]') {
                    for (j = 0, argil = arg.length; j < argil; j++) {
                        retObj[ct++] = arg[j];
                    }
                } else {
                    for (k in arg) {
                        if (arg.hasOwnProperty(k)) {
                            if (parseInt(k, 10) + '' === k) {
                                retObj[ct++] = arg[k];
                            } else {
                                retObj[k] = arg[k];
                            }
                        }
                    }
                }
            }
            return retObj;
        },
        empty = function(mixedVar) {
            var undef,
                key,
                i,
                len,
                emptyValues = [undef, null, false, 0, '', '0'];

            for (i = 0, len = emptyValues.length; i < len; i++) {
                if (mixedVar === emptyValues[i]) {
                    return true;
                }
            }

            if (typeof mixedVar === 'object') {
                for (key in mixedVar) {
                    if (mixedVar.hasOwnProperty(key)) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        },
        diff_date = function(e) {
            if (!isNaN(e)) {
                var a = parseInt(new Date() / 1e5, 10),
                    n = parseInt(e / 1e5, 10);
                return parseInt((n - a) / 864, 10);
            }
        },
        dirname = function(path) {
            return path.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '');
        };

    // 文件路径
    var COOKIE_FILE = dirname(__dirname) + '/data/cookie.json',
        AGENT_DB = dirname(__dirname) + "/data/agent.db",
        CONF_PATH = dirname(__dirname) + '/data/conf.json',
        TMP_FILE = dirname(__dirname) + '/data/tmp.json';

    // 创建对象开始
    var Ingress = function(mintime) {
        // 前面的历史记录时间
        this.mintime = isNaN(mintime) ? mintime : 15;
        // 是否开启保存cookie
        this.is_cookie = true;
        // 配置文件
        this.conf = this.getConf();
        // 默认头文件信息
        this.headers = {
            'Cache-Control': 'max-age=0',
            'User-Agent': this.conf.UA,
            'Upgrade-Insecure-Requests': '1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8',
            'Origin': 'https://www.ingress.com',
            'Referer': 'https://www.ingress.com/intel',
            'X-CSRFToken': this.getToken()
        };
        this.db = new Sqlite3.Database(AGENT_DB);
    };

    Ingress.prototype.curl = function(url, body, headers, call) {
        var header = typeof headers === 'object' ? merge(this.headers, headers) : this.headers,
            callback = typeof call === 'function' ? call : function() {},
            option = {
                "url": undefined,
                "method": 'GET',
                "headers": header,
                "timeout": 30,
                // "proxy": 'http://127.0.0.1:8080',
                "followAllRedirects": true,
                "followOriginalHttpMethod": true,
            };

        option.url = url;

        // 设置cookie
        if (this.is_cookie) {
            var jar = request.jar();
            this.conf.cookie.split('; ').map(function(item) {
                if (item !== '') jar.setCookie(item, option.url);
            });
            var cookie_jar = request.jar(new FileCookieStore(COOKIE_FILE, { sync: true }));
            cookie_jar.getCookieString(option.url).split('; ').map(function(item) {
                if (item !== '') jar.setCookie(item, option.url);
            });
            jar.getCookieString(option.url).split('; ').map(function(item) {
                if (item !== '') cookie_jar.setCookie(item, option.url);
            });
            option.jar = cookie_jar;
        }
        if (body !== undefined) {
            option.headers['Content-type'] = header.hasOwnProperty('Content-type') ? header['Content-type'] : 'application/x-www-form-urlencoded';
            option.body = typeof body === 'object' ? http_build_query(body) : body;
            option.method = 'POST';
        }
        request(option, callback);
    };

    Ingress.prototype.getConf = function() {
        var conf = (new Conffs(CONF_PATH)).get();
        if (!conf.hasOwnProperty('cookie') || conf.cookie === '') {
            throw new Error('Conf cookie Not Set');
        }
        if (!conf.hasOwnProperty('UA') || conf.UA === '') {
            throw new Error('Conf UA Not Set');
        }
        if (!conf.hasOwnProperty('minLatE6') || conf.minLatE6 === '') {
            throw new Error('Conf minLatE6 Not Set');
        }
        if (!conf.hasOwnProperty('minLngE6') || conf.minLngE6 === '') {
            throw new Error('Conf minLngE6 Not Set');
        }
        if (!conf.hasOwnProperty('maxLatE6') || conf.maxLatE6 === '') {
            throw new Error('Conf maxLatE6 Not Set');
        }
        if (!conf.hasOwnProperty('maxLngE6') || conf.maxLngE6 === '') {
            throw new Error('Conf maxLngE6 Not Set');
        }
        if (!conf.hasOwnProperty('latE6') || conf.latE6 === '') {
            throw new Error('Conf latE6 Not Set');
        }
        if (!conf.hasOwnProperty('lngE6') || conf.lngE6 === '') {
            throw new Error('Conf lngE6 Not Set');
        }
        return conf;
    };

    Ingress.prototype.getToken = function() {
        var cookie = request.jar(new FileCookieStore(COOKIE_FILE));
        var matchs;
        // if (matchs = cookie.getCookieString('http://127.0.0.1/').match(/csrftoken=(\w+)(?=;)?/im)) {
        if (matchs = cookie.getCookieString('https://www.ingress.com/intel').match(/csrftoken=(\w+)(?=;)?/im)) {
            return matchs[1];
        }
        if (matchs = this.conf.cookie.match(/csrftoken=(\w+)(?=;)?/im)) {
            return matchs[1];
        }
        throw new Error('Get csrftoken Error');
    };

    Ingress.prototype.getV = function(call) {
        var cb = typeof call === 'function' ? call : function() {};
        var preg = function(data) {
            var v = data.match(/<script\stype="text\/javascript"\ssrc="\/jsc\/gen_dashboard_(\w+)\.js"><\/script>/im);
            if (v && v.length == 2) {
                return v[1];
            } else {
                return false;
            }
        };
        // this.curl('http://127.0.0.1/b.php', undefined, undefined, (err, res, data) => {
        this.curl('https://www.ingress.com/intel', undefined, undefined, (err, res, data) => {
            if (!err && res.statusCode == 200) {
                var v;
                if (v = data.match(/<a\shref="(.*?)"\s*class=".*?"\s*onClick=".*?">Sign\s*in<\/a>/im)) {
                    if (v.length != 2) {
                        cb(false);
                    } else {
                        this.curl(v[1], undefined, undefined, (er, re, dat) => {
                            if (!er && re.statusCode == 200) {
                                cb(preg(dat));
                            } else {
                                cb(false);
                            }
                        });
                    }
                } else {
                    cb(preg(data));
                }
            } else {
                cb(false);
            }
        });
    };

    Ingress.prototype.getMsg = function(call) {
        var cb = typeof call === 'function' ? call : function() {},
            // url = 'http://127.0.0.1/a.php',
            url = 'https://www.ingress.com/r/getPlexts',
            header = { 'Content-type': 'application/json; charset=UTF-8' },
            data = {
                "minLatE6": this.conf.minLatE6,
                "minLngE6": this.conf.minLngE6,
                "maxLatE6": this.conf.maxLatE6,
                "maxLngE6": this.conf.maxLngE6,
                "minTimestampMs": ((new Date()).getTime() - 60000 * this.mintime),
                "maxTimestampMs": -1,
                "tab": "faction",
                "ascendingTimestampOrder": true,
                "v": this.conf.v
            };
        this.curl(url, JSON.stringify(data), header, function(err, res, data) {
            if (!err) {
                if (res.statusCode == 200) {
                    try {
                        cb(JSON.parse(data));
                    } catch (e) {
                        throw e;
                    }
                } else {
                    cb(false);
                }
            } else {
                throw err;
            }
        });
    };

    Ingress.prototype.sendMsg = function(msg, callback) {
        if (!empty(msg)) {
            var time = new Date(),
                cb = typeof(callback) === 'function' ? callback : function() {},
                // url = 'http://127.0.0.1/a.php?r',
                url = 'https://www.ingress.com/r/sendPlext',
                header = { 'Content-type': 'application/json; charset=UTF-8' },
                data = {
                    "message": msg,
                    "latE6": this.conf.latE6,
                    "lngE6": this.conf.lngE6,
                    "tab": "faction",
                    "v": this.conf.v
                };
            this.curl(url, JSON.stringify(data), header, function(err, res, data) {
                if (!err) {
                    if (res.statusCode == 200) {
                        try {
                            cb(JSON.parse(data));
                        } catch (e) {
                            throw e;
                        }
                    } else {
                        cb(false);
                    }
                } else {
                    throw err;
                }
            });
        }
    };

    Ingress.prototype.auto_send_msg_new_agent = function(call) {
        var cb = typeof call === 'function' ? call : function() {},
            tmp = new Conffs(TMP_FILE),
            agents = [];
        // 检测是否萌新
        var CheckNewAgent = function(stmt, value) {
            var match, agent;
            if ((match = value.match(/\[secure\]\s+(\w+):\s+has\scompleted\straining\.?/im))) {
                if (match.length == 2) {
                    agent = match[1];
                } else {
                    return false;
                }
            } else if ((match = value.match(/\[secure\]\s(\w+):\s+.*/im))) {
                if (match.length == 2) {
                    if (value.match(/(大家好|我是萌新|新人求带|新人求罩|大佬们求带|求组织|带带我)/im)) {
                        agent = match[1];
                    } else {
                        return false;
                    }
                }
            } else {
                return false;
            }
            stmt.get(agent, (err, row) => {
                if (row.hasOwnProperty('num') && row.num === 0) {
                    agents.push(agent);
                }
            });
        };
        // 开始流程
        var Start = (v) => {
            this.conf.v = v;
            this.getMsg((data) => {
                if (data) {
                    if (data.hasOwnProperty('result')) {
                        var result = data.result;
                        try {
                            this.db.serialize(() => {
                                var stmt = this.db.prepare('SELECT COUNT(`id`) AS num FROM `user` WHERE `agent`=?');
                                for (var key in result) {
                                    CheckNewAgent(stmt, result[key][2].plext.text);
                                }
                                // 处理完成执行
                                stmt.finalize(() => {
                                    var time = new Date(),
                                        st = '',
                                        newagentarr = [];
                                    for (var k in agents) {
                                        st += '@' + agents[k] + '  ';
                                        newagentarr.push('("' + agents[k] + '", ' + time.getTime() + ')');
                                    }
                                    if (st !== '' && !empty(newagentarr)) {
                                        this.sendMsg(st + ' ' + this.randMsg(), (data) => {
                                            if (data && data.hasOwnProperty('result') && data.result == 'success') {
                                                this.db.run("INSERT INTO `user` (`agent`, `createtime`) VALUES " + newagentarr.join(','), function(err) {
                                                    if (!err) {
                                                        cb('message send success,Info storage success');
                                                    } else {
                                                        cb('message send success,Info storage error');
                                                    }
                                                });
                                            } else {
                                                cb('Send Message Error');
                                            }
                                        });
                                    } else {
                                        cb('Not New Agent');
                                    }
                                });
                            });
                        } catch (e) {
                            throw e;
                        } finally {
                            this.db.close();
                        }
                    } else {
                        cb('Not New Message');
                    }
                } else {
                    cb('Get Msg Error');
                }
            });
        };

        if (tmp.get('time') === null || diff_date(tmp.get('time')) < 0) {
            this.getV(function(data) {
                if (data !== false) {
                    tmp.set({ 'v': data, 'time': (new Date()).getTime() });
                    tmp.save(function(status, e) {
                        if (status !== false) {
                            Start(tmp.get('v'));
                        } else {
                            throw e;
                        }
                    });
                } else {
                    throw new Error('Get V Error');
                }
            });
        } else {
            Start(tmp.get('v'));
        }
    };

    Ingress.prototype.randMsg = function() {
        var data;
        if (this.conf.hasOwnProperty('rand_msg') && !empty(this.conf.rand_msg)) {
            data = this.conf.rand_msg;
        } else {
            data = [
                ' 欢迎新人，快来加入川渝蓝军群(群号126821831)，发现精彩内容。',
                ' 欢迎选择加入抵抗军·川渝蓝军群(群号126821831)，一起为建设社会主义社会、实现人类的全面自由发展而奋斗吧',
                ' 您已进入秋名山路段，此处常有老司机出没，加入川渝蓝军群(群号126821831)，寻找这里的老司机吧',
                ' 欢迎加入熊猫抵抗军(群号126821831)，感谢你在与shapers的斗争中选择了人性与救赎，选择与死磕并肩同行。新人你好，我是死磕。',
                ' ingrees亚洲 中国分区 川渝地区组织需要你！快来加入川渝蓝军群(群号126821831)',
            ];
        }
        return data[parseInt(Math.random() * (data.length - 1), 10)];
    };
    module.exports = Ingress;
})();
