'use strict';

/**
 * [Ingress Ingress]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:07:05+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 mintime    [拉取最近消息时间（分钟）]
 */
function Ingress(mintime) {
    var file = __dirname + "/" + "agent.db",
        conf = __dirname + "/" + "conf.json",
        mintimes = mintime || 15;
    var fs = require("fs");
    if (!fs.existsSync(conf)) {
        throw new Error('Conf Not Found');
    }
    var data = fs.readFileSync(conf, "utf-8");
    try {
        this.conf = JSON.parse(data.replace(/((\r|\n|^\s*)+\/\/.+[^"\']|\r|\n|^\s+)*/img, ''));
    } catch (e) {
        throw new Error(e);
    }
    this.check_conf(); //检测conf
    var sqlite3 = require("sqlite3").verbose();
    this.agent = [];
    this.https = require('https');
    this.BufferHelper = require('./BufferHelper');
    this.mintime = mintimes;
    this.db = new sqlite3.Database(file);
    this.db1 = new sqlite3.Database(file);
    var cookie = this.conf.cookie,
        csrf = this.conf['x-csrftoken'],
        UA = this.conf['UA'];
    //json转换为字符串
    this.options = {
        host: 'www.ingress.com',
        port: 443,
        method: 'POST',
        headers: {
            'accept': '*/*',
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept-Language': 'zh-CN,zh;q=0.8',
            'Cookie': cookie,
            'Origin': 'https://www.ingress.com',
            'Referer': 'https://www.ingress.com/intel',
            'User-Agent': UA,
            'x-csrftoken': csrf
        }
    };
}
/**
 * [request 请求]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:07:17+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 path       [请求路径]
 * @param     {[type]}                 data       [请求数据]
 * @param     {Function}               callback   [description]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.request = function(path, data, callback) {
    var paths = (path || ''),
        datas = (data || ''),
        callbacks = typeof(callback) === 'function' ? callback : function() {};
    this.options.path = paths;
    this.options.headers['Content-Length'] = Buffer.byteLength(datas);
    var BufferHelper = new this.BufferHelper();
    var req = this.https.request(this.options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            BufferHelper.concat(chunk);
        });
        res.on('end', function() {
            callback(BufferHelper.toBuffer().toString());
        });
    });
    req.write(datas);
    req.end();
};
/**
 * [get_msg 获取数据]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:07:26+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {Function}               callback   [description]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.get_msg = function(callback) {
    var time = new Date();
    var url = '/r/getPlexts',
        data = '{"minLatE6":' + this.minLatE6 + ',"minLngE6":' + this.minLngE6 + ',"maxLatE6":' + this.maxLatE6 + ',"maxLngE6":' + this.maxLngE6 + ',"minTimestampMs":' + (time.getTime() - 60000 * this.mintime) + ',"maxTimestampMs":-1,"tab":"faction","ascendingTimestampOrder":true,"v":"' + this.conf.v + '"}',
        callbacks = typeof(callback) === 'function' ? callback : function() {};
    this.request(url, data, (result) => {
        try {
            callbacks(JSON.parse(result));
        } catch (e) {
            callbacks(null);
        }
    });
};
/**
 * [send_msg 发送数据]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:07:32+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 msg        [请求信息]
 * @param     {Function}               callback   [description]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.send_msg = function(msg, callback) {
    if (this.isset(msg) && !this.empty(msg)) {
        var time = new Date();
        var url = '/r/sendPlext',
            data = '{"message":"' + msg + '","latE6":' + this.latE6 + ',"lngE6":' + this.lngE6 + ',"tab":"faction","v":"' + this.conf.v + '"}',
            callbacks = typeof(callback) === 'function' ? callback : function() {};
        this.request(url, data, (result) => {
            try {
                callbacks(JSON.parse(result));
            } catch (e) {
                callbacks(null);
            }
        });
    }
};
/**
 * [new_agent_add 添加萌新]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:07:39+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 agent      [萌新id]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.new_agent_add = function(agent) {
    this.agent.push(agent);
};
/**
 * [get_new_agent 获取萌新]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:07:48+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 msg        [验证信息]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.get_new_agent = function(msg) {
    var match,
        patt = /\[secure\]\s+(\w+):\s+has completed training\.?/im,
        patt1 = /\[secure\]\s(\w+):\s+.*/im,
        patt2 = /(我是萌新|新人求带|新人求罩|大佬们求带|求组织|带带我)/im;
    if ((match = msg.match(patt))) {
        if (match.length == 2) {
            this.check_new_agent(match[1]);
        }
    } else if ((match = msg.match(patt1))) {
        if (match.length == 2) {
            if (msg.match(patt2)) {
                this.check_new_agent(match[1]);
            }
        }
    }
};
/**
 * [check_new_agent 检测是不是萌新]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:07:55+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 agent      [萌新id]
 * @param     {Function}               callback   [description]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.check_new_agent = function(agent, callback) {
    var callbacks = typeof(callback) === 'function' ? callback : function() {};
    if (this.isset(agent) && !this.empty(agent)) {
        this.db.serialize(() => {
            this.db.get('SELECT COUNT(`id`) AS num FROM `user` WHERE `agent`="' + agent + '"', (err, row) => {
                if (!err) {
                    if (row.num == 0) {
                        this.new_agent_add(agent);
                    }
                }
            });
        });
    }
};
/**
 * [auto_send_msg_new_agent 自动给萌新发消息]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:08:07+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {Function}               callback   [description]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.auto_send_msg_new_agent = function(callback) {
    var callbacks = typeof(callback) === 'function' ? callback : function() {};
    this.get_msg((result) => {
        if (result) {
            if (!this.empty(result.result)) {
                var data = result.result;
                for (var key in data) {
                    this.get_new_agent(data[key][2].plext.text);
                }
                this.destruct((agents) => {
                    var time = new Date(),
                        st = '',
                        arr = [];
                    for (var k in agents) {
                        st += '@' + agents[k] + '  ';
                        arr.push('("' + agents[k] + '",' + time.getTime() + ')');
                    }
                    this.agent = [];
                    if (st != '' && !this.empty(arr)) {
                        this.send_msg(st + ' ' + this.rand_msg(), (data) => {
                            if (data && !this.empty(data.result) && data.result == 'success') {
                                this.db1.run("INSERT INTO `user` (`agent`, `createtime`) VALUES " + arr.join(','), function(err) {
                                    if (err) {
                                        callbacks('message send success,Info storage success');
                                    } else {
                                        callbacks('message send success,Info storage error');
                                    }
                                });
                                this.db1.close();
                            } else {
                                callbacks('Send Message Error');
                            }
                        });
                    } else {
                        callbacks('Not New Agent');
                    }
                });
            } else {
                callbacks('Not New Message');
            }
        } else {
            callbacks('Get Message Error');
        }
    });
};
/**
 * [isset 检测变量是否设置]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:08:29+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 variable        [变量]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.isset = function(variable) {
    if (typeof(variable) == 'undefined' || typeof(variable) == 'null') {
        return false;
    }
    return true;
};
/**
 * [empty 判断对象是否空的]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:08:43+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {[type]}                 variable        [变量]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.empty = function(variable) {
    for (var k in variable) {
        return false;
    }
    return true;
};
/**
 * [rand_msg 给萌新发送得随机消息]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:08:54+0800
 * @copyright (c)                      ZiShang520    All Rights Reserved
 * @return    {[type]}                 [随机得萌新消息]
 */
Ingress.prototype.rand_msg = function() {
    var data;
    if (this.isset(this.conf.rand_msg) && this.conf.rand_msg != '') {
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
    return data[parseInt(Math.random() * (data.length - 1))];
};

Ingress.prototype.check_conf = function() {
    if (!this.isset(this.conf.cookie) || this.conf.cookie == '') {
        throw new Error('Conf cookie Not Set');
    }
    if (!this.isset(this.conf['x-csrftoken']) || this.conf['x-csrftoken'] == '') {
        throw new Error('Conf x-csrftoken Not Set');
    }
    if (!this.isset(this.conf.UA) || this.conf.UA == '') {
        throw new Error('Conf UA Not Set');
    }
    if (!this.isset(this.conf.v) || this.conf.v == '') {
        throw new Error('Conf v Not Set');
    }
    if (!this.isset(this.conf.minLatE6) || this.conf.minLatE6 == '') {
        throw new Error('Conf minLatE6 Not Set');
    }
    if (!this.isset(this.conf.minLngE6) || this.conf.minLngE6 == '') {
        throw new Error('Conf minLngE6 Not Set');
    }
    if (!this.isset(this.conf.maxLatE6) || this.conf.maxLatE6 == '') {
        throw new Error('Conf maxLatE6 Not Set');
    }
    if (!this.isset(this.conf.maxLngE6) || this.conf.maxLngE6 == '') {
        throw new Error('Conf maxLngE6 Not Set');
    }
    if (!this.isset(this.conf.latE6) || this.conf.latE6 == '') {
        throw new Error('Conf latE6 Not Set');
    }
    if (!this.isset(this.conf.lngE6) || this.conf.lngE6 == '') {
        throw new Error('Conf lngE6 Not Set');
    }
};
/**
 * [destruct 数据库连接结束执行函数]
 * @Author    ZiShang520@gmail.com
 * @DateTime  2016-08-17T14:09:05+0800
 * @copyright (c)                      ZiShang520 All           Rights Reserved
 * @param     {Function}               callback   [description]
 * @return    {[type]}                            [description]
 */
Ingress.prototype.destruct = function(callback) {
    var callbacks = typeof(callback) === 'function' ? callback : function() {};
    this.db.close(() => {
        callbacks(this.agent);
    });
};
//模块
module.exports = Ingress;
