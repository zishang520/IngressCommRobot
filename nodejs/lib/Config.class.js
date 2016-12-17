(function() {
    'use strict';
    /**
     * [Config 配置文件class]
     * @Author    ZiShang520@gmail.com
     * @DateTime  2016-12-08T18:02:01+0800
     * @copyright (c)                      ZiShang520 All           Rights Reserved
     * @param     {[type]}                 file_name  [description]
     */
    var fs = require('fs');

    var Config = function(file_name, option) {
        this.file_name = file_name || '';
        this.arr = {};
        this.option = typeof option === 'object' ? option : {};
        if (fs.existsSync(this.file_name)) {
            try {
                var arr = new Function('return (' + fs.readFileSync(this.file_name, 'utf8') + ')')();
                this.arr = (typeof arr === 'object') ? arr : {};
            } catch (err) {
                if (!(err instanceof SyntaxError)) {
                    throw new Error('Unexpected error type in json decode');
                }
                this.arr = {};
            }
        }
    };

    Config.prototype.set = function(name, value) {
        if (arguments.length == 1 && typeof name === 'object') {
            this.arr = this.merge(name);
        } else if (arguments.length == 2) {
            this.arr[name] = value;
        } else {
            this.arr = this.merge(arguments);
        }
    };

    Config.prototype.clear = function() {
        this.arr = {};
        return true;
    };

    Config.prototype.del = function(name) {
        var n = name || '';
        if (n === '') {
            return false;
        }
        return delete this.arr[n];
    };

    Config.prototype.get = function(name) {
        var n = name || '';
        if (n === '') {
            return this.arr;
        }
        if (name in this.arr) {
            return this.arr[name];
        }
        return null;
    };

    Config.prototype.save = function(call) {
        var callback = (typeof call === 'function') ? call : function() {};
        var data = JSON.stringify(this.arr);
        if (this.option.hasOwnProperty('sync') && !!this.option.sync) {
            try {
                fs.writeFileSync(this.file_name, data);
                callback(true);
            } catch (e) {
                callback(false, e);
            }
        } else {
            fs.writeFile(this.file_name, data, function(err) {
                if (err) {
                    callback(false, err);
                } else {
                    callback(true);
                }
            });
        }
    };

    Config.prototype.is_scalar = function(value) {
        return (/boolean|number|string/).test(typeof value);
    };

    Config.prototype.merge = function() {
        var args = Array.prototype.slice.call(arguments),
            argl = args.length,
            arg,
            retObj = this.arr,
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
    };

    module.exports = Config;
})();
