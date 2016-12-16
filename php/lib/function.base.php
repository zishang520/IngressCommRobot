<?php

spl_autoload_register(function ($class) {
    if (file_exists(__DIR__ . '/' . $class . '.class.php')) {
        require __DIR__ . '/' . $class . '.class.php';
    } else {
        die($class . '类引入失败');
    }
});

function my_date_diff($data2)
{
    $datetime1 = new DateTime(date('Y-m-d'));
    $datetime2 = new DateTime($data2);
    $interval = $datetime1->diff($datetime2);
    return intval($interval->format('%R%a'));
}