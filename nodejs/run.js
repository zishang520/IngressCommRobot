'use strict';

var time = new Date();
if (7 <= time.getHours() && time.getHours() <= 23) {
    var Ingress = require(__dirname + "/lib/Ingress.class.js");
    var i = new Ingress(16);
    i.auto_send_msg_new_agent(function(data) {
        console.log(data);
    });
} else {
    console.log('time 00-06 not run');
}
