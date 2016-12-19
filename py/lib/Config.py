# -*- coding: utf-8 -*-

"""
Config
"""
__author__ = 'zishang520'

import os
import json
import codecs


class Config(object):

    def __init__(self, file_name=''):
        # 检测文件名的合法性
        if not isinstance(file_name, (str)) or file_name == '':
            raise TypeError('File name Error')

        self.__fileName = file_name

        # 判断文件是否存在
        if os.path.isfile(self.__fileName):

            with codecs.open(self.__fileName, 'r', 'utf-8') as _F:
                # 捕获异常配置文件
                try:
                    self.__conf = json.load(_F)
                except Exception:
                    self.__conf = {}
        else:
            self.__conf = {}

    # 设置值
    # set('1555', 555555, 6666, a=45454,abcd=99999)
    def set(self, *args, **args2):
        # 判断类型
        if len(args) == 1:
            # 判断是否为dict
            if isinstance(args[0], dict):
                # 合并dict
                self.__conf.update(args[0])
        # 只接受两个tuple，后边的忽略
        elif len(args) >= 2 and isinstance(args[0], str):
            self.__conf[args[0]] = args[1]

        if len(args2) > 0:
            self.__conf.update(args2)

    # 获取值
    def get(self, name=''):
        # 判断是否是字符串并且不为空
        if isinstance(name, str) and name != '':
            # 判断是否存在
            if name in self.__conf:
                return self.__conf[name]
        else:
            return self.__conf

    # 清空
    def clear(self):
        self.__conf.clear()

    # 删除
    def delete(self, name=''):
        # 判断是否是字符串并且不为空
        if isinstance(name, str) and name != '':
            # 判断是否存在
            if name in self.__conf:
                del self.__conf[name]
                return True
        return False

    # 保存文件
    def save(self):
        with codecs.open(self.__fileName, 'w', 'utf-8') as _F:
            # 捕获异常配置文件
            json.dump(self.__conf, _F)
        return True

if __name__ == '__main__':
    print(
        'Run:\n\nfrom lib import Config\n\nC = Config("./a.json")\nC.set({"a":1},test=9)\nprint(C.get())\nprint(C.get("test"))\nC.save()\n')
