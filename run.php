<?php
date_default_timezone_set('Asia/ShangHai');
include 'ingress.php';
$h = intval(date('H'));
if (7 <= $h && $h <= 23) {
    $a = new ingress(16);
    echo $a->auto_send_msg_new_agent();
} else {
    echo 'time 00-06 not run';
}
