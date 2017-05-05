# -*- coding: utf-8 -*-

"""
Ingress
"""

import os
import json
import codecs
import requests
import sqlite3
import re
import time
import random

from urllib.parse import urlparse, quote
from http.cookiejar import MozillaCookieJar
from bs4 import BeautifulSoup as bs

# 自有扩展
from lib.Config import Config

__author__ = 'zishang520@gmail.com'


class Ingress(object):

    # 当前路径
    __PARENTDIR__ = os.path.dirname(os.path.dirname(__file__))
    # cookie文件
    __COOKIE_FILE__ = os.path.join(__PARENTDIR__, 'data/cookie.ini')
    # 萌新数据库
    __AGENT_DB__ = os.path.join(__PARENTDIR__, "data/agent.db")
    # 配置文件
    __CONF_PATH__ = os.path.join(__PARENTDIR__, 'data/conf.json')
    # 暂存文件
    __TMP_FILE__ = os.path.join(__PARENTDIR__, 'data/tmp.json')

    def __init__(self, mintime=15):
        if not isinstance(mintime, int) or mintime <= 0:
            raise TypeError(
                'The mintime must be a int and Not less than or equal to zero')
        if not os.path.isfile(self.__CONF_PATH__):
            raise IOError('File "' + self.__CONF_PATH__ + '"is Not Found')

        # 设置获取消息的时间
        self.__mintime = mintime

        # 获取基础配置
        self.__conf = self.__get_conf()
        # 基础headers头
        self.__headers = {
            'Cache-Control': 'no-cache, no-store',
            'User-Agent': self.__conf['UA'],
            'Upgrade-Insecure-Requests': '1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
            'Accept-encoding': 'gzip',
            'Dnt': '1',
        }
        self.__conf['v'] = self.__get_user_v()
        self.__headers.update({'X-CSRFToken': self.__get_token()})
        self.__conn = sqlite3.connect(self.__AGENT_DB__)

    # 请求
    def request(self, url='', body=None, headers={}):
        if not isinstance(url, str) or url == '':
            raise TypeError('The Url must be a string and can not be empty')
        if body is not None and not isinstance(body, (str, dict, bytes)):
            raise TypeError('The Body must be a string or dict')
        if not isinstance(headers, dict):
            raise TypeError('The Headers must be a dict')

        # 更新header
        self.__headers.update(headers)

        # 基础参数
        Option = {
            "proxies": {
                # 'http': 'http://127.0.0.1:8080',
                # 'https': 'http://127.0.0.1:8080',
            },
            "verify": True,
            "allow_redirects": True,  # 开启自动重定向
            "timeout": 30,  # 超时时间s
            "headers": self.__headers,  # 请求头
        }
        # 启用会话模式
        session = requests.session()
        session.cookies = MozillaCookieJar(self.__COOKIE_FILE__)

        # 服务器发送的cookie
        if os.path.isfile(self.__COOKIE_FILE__):
            # 存在则导入
            session.cookies.load(ignore_discard=True, ignore_expires=True)

        # 判断是post还是get
        if body is None:
            r = session.get(url, **Option)
        else:
            r = session.post(url, data=body, **Option)

        # 保存cookie 文件
        session.cookies.save(ignore_discard=True, ignore_expires=True)

        # 返回对象
        return r

    # 获取配置文件
    def __get_conf(self):

        conf = {}
        # 该死的windows
        with codecs.open(self.__CONF_PATH__, 'r', 'utf-8') as _F:
            conf = json.load(_F)

            if not isinstance(conf, dict):
                raise TypeError('The Conf Must A Dict')

            if 'UA' not in conf or not isinstance(conf['UA'], str) or conf['UA'] == '':
                raise KeyError(
                    'undefined index UA or value is not string or value is empty')
            if 'email' not in conf or not isinstance(conf['email'], str) or conf['email'] == '':
                raise KeyError(
                    'undefined index email or value is not string or value is empty')
            if 'password' not in conf or not isinstance(conf['password'], str) or conf['password'] == '':
                raise KeyError(
                    'undefined index password or value is not string or value is empty')
            if 'minLatE6' not in conf or not isinstance(conf['minLatE6'], (int, str)) or conf['minLatE6'] == '':
                raise KeyError(
                    'undefined index minLatE6 or value is not int|string or value is empty')
            if 'minLngE6' not in conf or not isinstance(conf['minLngE6'], (int, str)) or conf['minLngE6'] == '':
                raise KeyError(
                    'undefined index minLngE6 or value is not int|string or value is empty')
            if 'maxLatE6' not in conf or not isinstance(conf['maxLatE6'], (int, str)) or conf['maxLatE6'] == '':
                raise KeyError(
                    'undefined index maxLatE6 or value is not int|string or value is empty')
            if 'maxLngE6' not in conf or not isinstance(conf['maxLngE6'], (int, str)) or conf['maxLngE6'] == '':
                raise KeyError(
                    'undefined index maxLngE6 or value is not int|string or value is empty')
            if 'latE6' not in conf or not isinstance(conf['latE6'], (int, str)) or conf['latE6'] == '':
                raise KeyError(
                    'undefined index latE6 or value is not int|string or value is empty')
            if 'lngE6' not in conf or not isinstance(conf['lngE6'], (int, str)) or conf['lngE6'] == '':
                raise KeyError(
                    'undefined index lngE6 or value is not int|string or value is empty')
        return conf

    # 获取令牌
    def __get_token(self):

        if os.path.isfile(self.__COOKIE_FILE__):
            with codecs.open(self.__COOKIE_FILE__, 'r', 'utf-8') as _F:
                matches = re.search(
                    r'(?<=csrftoken[\s*])\w+(?=\n)?', _F.read(), re.M | re.I | re.S)
                if matches is not None:
                    return matches.group()
        raise ValueError('Get token Error')

    # 获取v
    def __get_v(self):

        # r = self.request('http://127.0.0.1/d.php')
        r = self.request('https://www.ingress.com/intel')
        if r.status_code != 200:
            return False
        # 获取是否需要登陆
        info = re.search(r'<a\shref="(.*?)"\s.*?>Sign\sin<\/a>',
                         r.text,  re.M | re.I | re.S)
        # 判断存在并且有值
        if info is not None and len(info.groups()) == 1:
            if not self.__login(info.group(1)):
                return False
            r = self.request('https://www.ingress.com/intel')
            if r.status_code != 200:
                return False
        # 匹配v
        info = re.search(
            r'<script\stype="text\/javascript"\ssrc="\/jsc\/gen_dashboard_(\w+)\.js"><\/script>', r.text,  re.M | re.I | re.S)
        # 判断匹配不为空
        if info is not None and len(info.groups()) == 1:
            return info.group(1)

        return False

    def __check_islogin(self, body):

        _info = re.search(r'(登录|login)',
                          body,  re.M | re.I | re.S)
        return not (_info is not None and len(_info.groups()) == 1)

    # Login
    def __login(self, login_url):

        if not isinstance(login_url, str) or login_url == '':
            raise TypeError(
                'The login_url must be a string and can not be empty')
        _ = self.request(login_url)
        if _.status_code != 200:
            raise ValueError('Get Login Url Error')

        # 是否已经登录
        if self.__check_islogin(_.text):
            return True

        _login = bs(_.text, 'lxml')

        # 默认跳转地址
        _JumpUrl = 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fappengine.google.com%2F_ah%2Fconflogin%3Fcontinue%3Dhttps%3A%2F%2Fwww.ingress.com%2Fintel&rip=1&nojavascript=1&service=ah&ltmpl=gm'
        for k in _login.select('meta[http-equiv="refresh"]'):
            _Info = re.search(r'(?<=url\=).+',
                              k['content'],  re.M | re.I | re.S)
            _JumpUrl = _Info.group(0).replace('&amp;', '&')

        header = {
            'Origin': 'https://accounts.google.com'
        }
        header.update({
            'Referer': _.url
        })

        _jump_login_page = self.request(_JumpUrl, None, header)

        if _jump_login_page.status_code != 200:
            raise ValueError('Jump Login Page Error')

        html = bs(_jump_login_page.text, 'lxml')
        data = {
            'Email': self.__conf['email'],
        }
        for i in html.form.select('input[name]'):
            try:
                value = i['value']
            except KeyError:
                value = ''

            if i['name'] == 'Page':
                data.update({'Page': value})
            elif i['name'] == 'GALX':
                data.update({'GALX': value})
            elif i['name'] == 'gxf':
                data.update({'gxf': value})
            elif i['name'] == 'continue':
                data.update({'continue': value})
            elif i['name'] == 'service':
                data.update({'service': value})
            elif i['name'] == 'ltmpl':
                data.update({'ltmpl': value})
            elif i['name'] == 'rip':
                data.update({'rip': value})
            elif i['name'] == 'ProfileInformation':
                data.update({'ProfileInformation': value})
            elif i['name'] == 'SessionState':
                data.update({'SessionState': value})
            elif i['name'] == '_utf8':
                data.update({'_utf8': value})
            elif i['name'] == 'bgresponse':
                data.update({'bgresponse': value})
            elif i['name'] == 'identifiertoken':
                data.update({'identifiertoken': value})
            elif i['name'] == 'identifiertoken_audio':
                data.update({'identifiertoken_audio': value})
            elif i['name'] == 'identifier-captcha-input':
                data.update({'identifier-captcha-input': value})
            elif i['name'] == 'signIn':
                data.update({'signIn': value})
            elif i['name'] == 'Passwd':
                data.update({'Passwd': value})
            elif i['name'] == 'PersistentCookie':
                data.update({'PersistentCookie': value})
            elif i['name'] == 'rmShown':
                data.update({'rmShown': value})

        username_xhr_url = 'https://accounts.google.com/signin/v1/lookup'
        if 'action' in html.form:
            username_xhr_url = html.form['action']

        header.update({
            'Referer': _jump_login_page.url
        })
        # 验证邮箱
        _ = self.request(username_xhr_url, data, header)
        if _.status_code != 200:
            raise ValueError('Check User Email Error')

        _go_login = bs(_.text, 'lxml')
        login_data = {
            'Email': self.__conf['email'],
            'Passwd': self.__conf['password']
        }
        for i in _go_login.form.select('input[name]'):
            try:
                value = i['value']
            except KeyError:
                value = ''

            if i['name'] == 'Page':
                login_data.update({'Page': value})
            elif i['name'] == 'GALX':
                login_data.update({'GALX': value})
            elif i['name'] == 'gxf':
                login_data.update({'gxf': value})
            elif i['name'] == 'continue':
                login_data.update({'continue': value})
            elif i['name'] == 'service':
                login_data.update({'service': value})
            elif i['name'] == 'ltmpl':
                login_data.update({'ltmpl': value})
            elif i['name'] == 'rip':
                login_data.update({'rip': value})
            elif i['name'] == 'ProfileInformation':
                login_data.update({'ProfileInformation': value})
            elif i['name'] == 'SessionState':
                login_data.update({'SessionState': value})
            elif i['name'] == '_utf8':
                login_data.update({'_utf8': value})
            elif i['name'] == 'bgresponse':
                login_data.update({'bgresponse': value})
            elif i['name'] == 'signIn':
                login_data.update({'signIn': value})
            elif i['name'] == 'PersistentCookie':
                login_data.update({'PersistentCookie': value})
            elif i['name'] == 'rmShown':
                login_data.update({'rmShown': value})

        password_url = 'https://accounts.google.com/signin/challenge/sl/password'
        if 'action' in _go_login.form:
            password_url = _go_login.form['action']

        # 登录
        header.update({
            'Referer': _.url
        })
        _t = self.request(password_url, login_data, header)

        if _t.status_code != 200:
            raise ValueError('Google Login Error')

        if self.__check_islogin(_t.text):
            return True
        raise ValueError('Google Login Error')

    # 保存v
    def __get_user_v(self):
        _v = Config(self.__TMP_FILE__)
        if _v.get('time') is not None and self.__diff_date(_v.get('time')) >= 0:
            return _v.get('v')
        else:
            v = self.__get_v()
            if v is not False:
                _v.set({"v": v, "time": time.time()})
                if _v.save() is True:
                    return _v.get('v')
        raise ValueError('Get v Error')

    # 验证时间
    def __diff_date(self, date=0):
        if not isinstance(date, (int, float)):
            raise TypeError('date must be a int or float')
        time1 = int(time.time() / 100)
        time2 = int(date / 100)
        return int((time2 - time1) / 864)

    # 获取消息
    def get_msg(self):
        # url = 'http://127.0.0.1/c.php'
        url = 'https://www.ingress.com/r/getPlexts'
        header = {'Content-type': 'application/json; charset=UTF-8', 'Origin': 'https://www.ingress.com',
                  'Referer': 'https://www.ingress.com/intel'}
        data = '{"minLatE6":' + str(self.__conf['minLatE6']) + ',"minLngE6":' + str(self.__conf['minLngE6']) + ',"maxLatE6":' + str(self.__conf['maxLatE6']) + ',"maxLngE6":' + str(self.__conf[
            'maxLngE6']) + ',"minTimestampMs":' + str(int(time.time() * 1000 - 60000 * self.__mintime)) + ',"maxTimestampMs":-1,"tab":"faction","ascendingTimestampOrder":true,"v":"' + self.__conf['v'] + '"}'
        r = self.request(url, data.encode('UTF-8'), header)
        if r.status_code != 200:
            return False
        return json.loads(r.text)

    # 发送消息
    def send_msg(self, msg):
        if not isinstance(msg, str):
            raise TypeError('msg must be a string')

        # url = 'http://127.0.0.1/a.php?r'
        url = 'https://www.ingress.com/r/sendPlext'
        header = {'Content-type': 'application/json; charset=UTF-8', 'Origin': 'https://www.ingress.com',
                  'Referer': 'https://www.ingress.com/intel', }
        data = '{"message":"' + msg + '","latE6":' + str(self.__conf['latE6']) + ',"lngE6":' + str(
            self.__conf['lngE6']) + ',"tab":"faction","v":"' + self.__conf['v'] + '"}'

        r = self.request(url, data.encode('UTF-8'), header)
        if r.status_code != 200:
            return False
        return json.loads(r.text)

    # 检测萌新
    def __check_new_agent(self, value):
        if not isinstance(value, str):
            raise TypeError('value must be a string')
        matches = re.search(
            r'\[secure\]\s+(\w+):\s+has\scompleted\straining\.', value, re.M | re.I | re.S)
        if matches is not None:
            if len(matches.groups()) != 1:
                return False
            Agent = matches.group(1)
        else:
            matches = re.search(r'\[secure\]\s(\w+):\s+.*',
                                value, re.M | re.I | re.S)
            if matches is not None:
                if len(matches.groups()) != 1:
                    return False
                if re.search(self.regexp(), value, re.M | re.I | re.S) is not None:
                    Agent = matches.group(1)
                else:
                    return False
            else:
                return False
        _stmt = self.__conn.cursor()
        _stmt.execute(
            "SELECT COUNT(`id`) AS num FROM `user` WHERE `agent`=?", tuple({Agent}))
        num = _stmt.fetchone()
        if num is not None and len(num) == 1 and num[0] > 0:
            return False
        return Agent

    # 需要发送的消息
    def rand_msg(self):
        if 'rand_msg' not in self.__conf or not isinstance(self.__conf['rand_msg'], list) or len(self.__conf['rand_msg']) == 0:
            data = [
                ' 欢迎新人，快来加入川渝蓝军群(群号126821831)，发现精彩内容。',
                ' 欢迎选择加入抵抗军·川渝蓝军群(群号126821831)，一起为建设社会主义社会、实现人类的全面自由发展而奋斗吧',
                ' 您已进入秋名山路段，此处常有老司机出没，加入川渝蓝军群(群号126821831)，寻找这里的老司机吧',
                ' 欢迎加入熊猫抵抗军(群号126821831)，感谢你在与shapers的斗争中选择了人性与救赎，选择与死磕并肩同行。新人你好，我是死磕。',
                ' ingrees亚洲 中国分区 川渝地区组织需要你！快来加入川渝蓝军群(群号126821831)',
            ]
        else:
            data = self.__conf['rand_msg']
        return random.sample(data, 1)[0]

    # 关键词
    def regexp(self):
        if 'regexp' not in self.__conf or not isinstance(self.__conf['regexp'], list) or len(self.__conf['regexp']) == 0:
            data = r'(大家好|我是萌新|新人求带|新人求罩|大佬们求带|求组织|带带我)'
        else:
            data = '(' + self.__conf['regexp'].join('|') + ')'
        return data

    # 给萌新发消息啦
    def auto_send_msg_new_agent(self):
        _msg_list = self.get_msg()
        # 判断消息是否获取成功
        if _msg_list is False:
            return 'get message error'

        # 判断是否有消息
        if 'result' not in _msg_list or not isinstance(_msg_list['result'], (list, dict)) or len(_msg_list['result']) == 0:
            return 'Not new Message'

        _newagent_set = set()
        for k in _msg_list['result']:
            _newagent = self.__check_new_agent(k[2]['plext']['text'])
            if _newagent is not False:
                _newagent_set.update({_newagent})

        # 判断萌新数量
        if len(_newagent_set) == 0:
            return 'Not New Agent'

        _send_agent = ''
        _db_agent = list()
        for v in _newagent_set:
            _send_agent += '@' + v + '  '
            _db_agent.append((v, int(time.time())))

        r = self.send_msg(_send_agent + ' ' + self.rand_msg())
        if r is not False and 'result' in r and r['result'] == 'success':
            _stmt = self.__conn.cursor()
            _stmt.executemany(
                'INSERT INTO `user` (`agent`, `createtime`) VALUES (?, ?)', _db_agent)
            self.__conn.commit()
            if _stmt.rowcount > 0:
                return 'message send success,Info storage success'
            else:
                return 'message send success,Info storage error'
        else:
            return 'Send Message Error'

if __name__ == '__main__':
    print('Run:\n\nImport Ingress\n\nI = Ingress(16)\nprint(I.auto_send_msg_new_agent())\n')
