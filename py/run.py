# -*- coding: utf-8 -*-

from lib.Ingress import Ingress
import time


def run(i=16):
    _ = int(time.strftime("%H", time.localtime()))
    if 7 <= _ and _ <= 23:
        I = Ingress(i)
        print(I.auto_send_msg_new_agent())
    else:
        print('time 00-06 not run')

if __name__ == '__main__':
    run(16)
