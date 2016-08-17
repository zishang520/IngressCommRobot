'use strict';
var time = new Date();
if (7 <= time.getHours() && time.getHours() <= 23) {
    var schedule = require("node-schedule");
    var Ingress = require("./Ingress");
    var a = new Ingress(16);
    var rule = new schedule.RecurrenceRule();
    rule.minute = 15; //执行时间
    console.log('Landing...');
    var j = schedule.scheduleJob(rule, () => {
        a.auto_send_msg_new_agent((data) => {
            console.log(data);
        });
    });
} else {
    console.log('time 00-06 not run');
}
