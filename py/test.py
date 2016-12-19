# -*- coding: utf-8 -*-

from lib.Ingress import Ingress

I = Ingress(30)
# print(I.auto_send_msg_new_agent())
msg = '你好'
print(msg.encode('utf-8'))
print(I.send_msg('测试python发送中文'))