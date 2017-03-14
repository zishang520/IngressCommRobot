/*jshint esversion: 6 */
'use strict';

let time = new Date();
if (7 <= time.getHours() && time.getHours() <= 23) {
    const Ingress = require(__dirname + "/lib/Ingress.class.js");
    let i = new Ingress(16);
    i.auto_send_msg_new_agent(function(data) {
        console.log(data);
    });
} else {
    console.log('time 00-06 not run');
}
