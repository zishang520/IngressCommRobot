/*jshint esversion: 6 */
(function() {
    'use strict';

    // 内置对象
    const request = require('request'),
        Conffs = require(__dirname + '/Config.class.js'),
        FileCookieStore = require('tough-cookie-filestore'),
        Sqlite3 = require("sqlite3").verbose(),
        cheerio = require('cheerio');

    // 内置函数
    let http_build_query = function(formdata, numericPrefix, argSeparator) {

            let urlencode = function(str) {
                str = (str + '');
                return encodeURIComponent(str)
                    .replace(/!/g, '%21')
                    .replace(/'/g, '%27')
                    .replace(/\(/g, '%28')
                    .replace(/\)/g, '%29')
                    .replace(/\*/g, '%2A')
                    .replace(/%20/g, '+');
            };

            let value,
                key,
                tmp = [];

            let _httpBuildQueryHelper = function(key, val, argSeparator) {
                let k;
                let tmp = [];
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
                let query = _httpBuildQueryHelper(key, value, argSeparator);
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
            let args = Array.prototype.slice.call(arguments),
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
            let undef,
                key,
                i,
                len,
                emptyValues = [undef, null, false, 0, '', '0'];

            for (i = 0, len = emptyValues.length; i < len; i++) {
                if (mixedlet === emptyValues[i]) {
                    return true;
                }
            }

            if (typeof mixedlet === 'object') {
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
                let a = parseInt(new Date() / 1e5, 10),
                    n = parseInt(e / 1e5, 10);
                return parseInt((n - a) / 864, 10);
            }
        },
        dirname = function(path) {
            return path.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '');
        },
        array_unique = function(inputArr) {
            let key = '',
                tmpArr2 = {},
                val = '';

            let _arraySearch = function(needle, haystack) {
                let fkey = '';
                for (fkey in haystack) {
                    if (haystack.hasOwnProperty(fkey)) {
                        if ((haystack[fkey] + '') === (needle + '')) {
                            return fkey;
                        }
                    }
                }
                return false;
            };

            for (key in inputArr) {
                if (inputArr.hasOwnProperty(key)) {
                    val = inputArr[key];
                    if (_arraySearch(val, tmpArr2) === false) {
                        tmpArr2[key] = val;
                    }
                }
            }

            return tmpArr2;
        };

    // 文件路径
    const COOKIE_FILE = dirname(__dirname) + '/data/cookie.json',
        AGENT_DB = dirname(__dirname) + "/data/agent.db",
        CONF_PATH = dirname(__dirname) + '/data/conf.json',
        TMP_FILE = dirname(__dirname) + '/data/tmp.json';

    // 创建对象开始
    let Ingress = function(mintime) {
        // 前面的历史记录时间
        this.mintime = isNaN(mintime) ? mintime : 15;
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
            'Referer': 'https://www.ingress.com/intel'
        };
        this.db = new Sqlite3.Database(AGENT_DB);
    };

    Ingress.prototype.curl = function(url, body, headers, call) {
        let header = typeof headers === 'object' ? merge(this.headers, headers) : this.headers,
            callback = typeof call === 'function' ? call : function() {},
            option = {
                "url": undefined,
                "method": 'GET',
                "headers": header,
                // "timeout": 0,
                // "proxy": 'http://127.0.0.1:1080',
                // "strictSSL": false,
                "followAllRedirects": true,
                "followOriginalHttpMethod": false,
                "rejectUnauthorized": false,
            };

        option.url = url;

        // 设置cookie
        option.jar = request.jar(new FileCookieStore(COOKIE_FILE, { sync: true }));

        if (body !== undefined) {
            option.headers['Content-type'] = header.hasOwnProperty('Content-type') ? header['Content-type'] : 'application/x-www-form-urlencoded';
            option.body = typeof body === 'object' ? http_build_query(body) : body;
            option.method = 'POST';
        }
        request(option, callback);
    };

    Ingress.prototype.getConf = function() {
        let conf = (new Conffs(CONF_PATH)).get();
        if (!conf.hasOwnProperty('email') || conf.email === '') {
            throw new Error('Conf email Not Set');
        }
        if (!conf.hasOwnProperty('password') || conf.password === '') {
            throw new Error('Conf password Not Set');
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
        let cookie = request.jar(new FileCookieStore(COOKIE_FILE));
        let matchs = cookie.getCookieString('https://www.ingress.com/intel').match(/csrftoken=(\w+)(?=;)?/im);
        if (matchs && matchs.length == 2) {
            return matchs[1];
        }
        throw new Error('Get csrftoken Error');
    };

    Ingress.prototype.getV_token = function(call) {
        let cb = typeof call === 'function' ? call : function() {};
        let preg = (data) => {
            let v = data.match(/<script\stype="text\/javascript"\ssrc="\/jsc\/gen_dashboard_(\w+)\.js"><\/script>/im);
            if (v && v.length == 2) {
                return { "v": v[1], "token": this.getToken() };
            } else {
                return false;
            }
        };

        let auto_login = (login_url) => {
            let header = { 'Origin': 'https://accounts.google.com' };
            let data = {};
            data.Email = this.conf.email;

            let check_islogin = (body) => {
                return !((/(登录|login)/i).test(body));
            };
            let google_login = () => {
                let password_url = 'https://accounts.google.com/signin/challenge/sl/password';

                delete data.requestlocation;
                data.Page = 'PasswordSeparationSignIn';
                data.pstMsg = '1';
                data.identifiertoken = '';
                data.identifiertoken_audio = '';
                data['identifier-captcha-input'] = '';
                data.Passwd = this.conf.password;
                data.PersistentCookie = 'yes';
                this.curl(password_url, data, header, (er, re, dat) => {
                    if (!er && re.statusCode == 200) {
                        cb(preg(dat));
                    } else {
                        cb(false);
                    }
                });
            };
            let checkemail = (d) => {
                let $ = cheerio.load(d);
                $('form input[name]').each((i, item) => {
                    switch ($(item).attr('name')) {
                        case 'Page':
                            data.Page = $(item).val();
                            break;
                        case 'service':
                            data.service = $(item).val();
                            break;
                        case 'ltmpl':
                            data.ltmpl = $(item).val();
                            break;
                        case 'continue':
                            data.continue = $(item).val();
                            break;
                        case 'gxf':
                            data.gxf = $(item).val();
                            break;
                        case 'GALX':
                            data.GALX = $(item).val();
                            break;
                        case 'shdf':
                            data.shdf = $(item).val();
                            break;
                        case '_utf8':
                            data._utf8 = $(item).val();
                            break;
                        case 'bgresponse':
                            data.bgresponse = $(item).val();
                            break;
                        case 'rmShown':
                            data.rmShown = $(item).val();
                            break;
                    }
                });
                let username_xhr_url = 'https://accounts.google.com/_/signin/v1/lookup';
                this.curl(username_xhr_url, data, header, (er, re, dat) => {
                    if (!er && re.statusCode == 200) {
                        google_login(dat);
                    } else {
                        throw new Error('Check User Email Error');
                    }
                });
            };
            this.curl(login_url, undefined, header, (er, re, dat) => {
                if (!er && re.statusCode == 200) {
                    // check is login,jump to intel
                    if (check_islogin(dat)) {
                        this.getV_token(cb);
                    } else {
                        header.Referer = re.request.uri.href;
                        data.requestlocation = re.request.uri.href;
                        checkemail(dat);
                    }
                } else {
                    throw new Error('Get Login Url Error');
                }
            });
        };
        this.curl('https://www.ingress.com/intel', undefined, undefined, (err, res, data) => {
            if (!err && res.statusCode == 200) {
                let v = data.match(/<a\shref="(.*?)"\s*class=".*?"\s*onClick=".*?">Sign\s*in<\/a>/im);
                if (v) {
                    if (v.length != 2) {
                        cb(false);
                    } else {
                        auto_login(v[1]);
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
        let cb = typeof call === 'function' ? call : function() {},
            // url = 'http://127.0.0.1/a.php',
            url = 'https://www.ingress.com/r/getPlexts',
            header = { 'Content-type': 'application/json; charset=UTF-8' },
            data = '{"minLatE6":' + this.conf.minLatE6 + ',"minLngE6":' + this.conf.minLngE6 + ',"maxLatE6":' + this.conf.maxLatE6 + ',"maxLngE6":' + this.conf.maxLngE6 + ',"minTimestampMs":' + ((new Date()).getTime() - 60000 * this.mintime) + ',"maxTimestampMs":-1,"tab":"faction","ascendingTimestampOrder":true,"v":"' + this.conf.v + '"}';
        this.curl(url, data, header, function(err, res, data) {
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
            let time = new Date(),
                cb = typeof(callback) === 'function' ? callback : function() {},
                url = 'https://www.ingress.com/r/sendPlext',
                header = { 'Content-type': 'application/json; charset=UTF-8' },
                data = '{"message":"' + msg + '","latE6":' + this.conf.latE6 + ',"lngE6":' + this.conf.lngE6 + ',"tab":"faction","v":"' + this.conf.v + '"}';
            this.curl(url, data, header, function(err, res, data) {
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
        let cb = typeof call === 'function' ? call : function() {},
            tmp = new Conffs(TMP_FILE),
            agents = [];
        // 检测是否萌新
        let CheckNewAgent = function(stmt, value) {
            let match, agent;
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
        let Start = (g) => {
            this.conf.v = g.v;
            this.headers['X-CSRFToken'] = g.token;
            this.getMsg((data) => {
                if (data) {
                    if (data.hasOwnProperty('result')) {
                        let result = data.result;
                        try {
                            this.db.serialize(() => {
                                let stmt = this.db.prepare('SELECT COUNT(`id`) AS num FROM `user` WHERE `agent`=?');
                                for (let key in result) {
                                    CheckNewAgent(stmt, result[key][2].plext.text);
                                }
                                // 处理完成执行
                                stmt.finalize(() => {
                                    let time = new Date(),
                                        st = '',
                                        newagentarr = [];
                                    let unique_agents = array_unique(agents);
                                    for (let k in unique_agents) {
                                        st += '@' + unique_agents[k] + '  ';
                                        newagentarr.push('("' + unique_agents[k] + '", ' + time.getTime() + ')');
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
            this.getV_token(function(data) {
                if (data !== false) {
                    tmp.set({ 'v': data.v, 'token': data.token, 'time': (new Date()).getTime() });
                    tmp.save(function(status, e) {
                        if (status !== false) {
                            Start(tmp.get());
                        } else {
                            throw e;
                        }
                    });
                } else {
                    throw new Error('Get V Error');
                }
            });
        } else {
            Start(tmp.get());
        }
    };

    Ingress.prototype.randMsg = function() {
        let data;
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
