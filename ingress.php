<?php

/**
 * ingress
 */
class ingress
{
    //请求头信息
    private $header = array();
    //是都设置ssl
    public $ssl = false;
    //加载消息最近时间(分钟)
    private $mintime;
    //数据库连接
    private $sqllite;
    // 配置文件
    private $conf;
    // cookie 文件名
    private $cookie_file = 'cookie.txt';
    //构造函数
    public function __construct($mintime = 10)
    {
        $this->sqllite = new SQLite3('agent.db', SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
        file_exists('conf.json') || exit('conf.json Not Found');
        $conf = file_get_contents('conf.json');
        $conf = json_decode(preg_replace('/(\r|\n|^\s*|\/\/.+[^"\'])*/im', '', $conf), true);
        $this->conf = $conf ? $conf : array();
        $this->check_conf();
        $this->mintime = $mintime;
        $this->ssl = true;
        $this->header = array(
            'Cache-Control' => 'Cache-Control: max-age=0',
            'User-Agent' => 'User-Agent: '.$this->conf['UA'],
            'Upgrade-Insecure-Requests' => '1',
            'Accept:' => 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language' => 'Accept-Language: zh-CN,zh;q=0.8',
            'Origin' => 'Origin: https://www.ingress.com',
            'Referer' => 'Referer: https://www.ingress.com/intel',
            'X-CSRFToken' => 'X-CSRFToken: ' . $this->conf['x-csrftoken'],
        );
    }
    //请求
    protected function curl($url, $post = null, $header = array(), $cookie = true)
    {
        $header = array_merge_recursive($this->header, $header);
        $data = array(); //初始化空数组
        $ch = curl_init(); //初始化curl
        curl_setopt_array($ch,
            array(
                CURLOPT_URL => $url, //需要请求的地址
                // CURLOPT_PROXY => 'http://127.0.0.1:8080', // 不支持https
                CURLOPT_HTTPHEADER => $header, //设置header头
                CURLOPT_AUTOREFERER => true, // 自动设置跳转地址
                CURLOPT_FOLLOWLOCATION => true, //开启重定向
                CURLOPT_COOKIE => $this->conf['cookie'],//设置cookie
                CURLOPT_TIMEOUT => 30, //设置超时时间
                CURLOPT_RETURNTRANSFER => true, //设定是否显示头信息
                CURLOPT_HEADER => false, //设定是否输出页面内容
                CURLOPT_NOBODY => false, //是否设置为不显示html的body
            )
        );
        if (!empty($post)) {
            $post = is_array($post) ? http_build_query($post) : $post;
            curl_setopt_array($ch,
                array(
                    CURLOPT_POST => true, //post提交方式
                    CURLOPT_POSTFIELDS => $post,
                )
            );
        }
        if ($this->ssl) {
            curl_setopt_array($ch,
                array(
                    CURLOPT_SSL_VERIFYPEER => true, // 只信任CA颁布的证书
                    CURLOPT_CAINFO => __DIR__ . '/cacert.pem', // CA根证书（用来验证的网站证书是否是CA颁布）
                    CURLOPT_SSL_VERIFYHOST => 2,
                )
            ); // 检查证书中是否设置域名，并且是否与提供的主机名匹配
        }
        if ($cookie) {
            curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookie_file); //存储cookie信息
            curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookie_file); // use cookie
        }
        $data['info'] = curl_exec($ch);
        $data['status'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $data;
    }
    //获取消息
    public function get_msg()
    {
        $url = 'https://www.ingress.com/r/getPlexts';
        $header['content-type'] = 'content-type:application/json; charset=UTF-8';
        $data = '{"minLatE6":' . $this->conf['minLatE6'] . ',"minLngE6":' . $this->conf['minLngE6'] . ',"maxLatE6":' . $this->conf['maxLatE6'] . ',"maxLngE6":' . $this->conf['maxLngE6'] . ',"minTimestampMs":' . intval(microtime(true) * 1000 - 60000 * $this->mintime) . ',"maxTimestampMs":-1,"tab":"faction","ascendingTimestampOrder":true,"v":"' . $this->conf['v'] . '"}';
        $info = $this->curl($url, $data, $header);
        if ($info['status'] != 200) {
            return false;
        }
        return $info['info'];
    }
    //发送消息
    public function send_msg($msg)
    {
        $url = 'https://www.ingress.com/r/sendPlext';
        $header['content-type'] = 'content-type:application/json; charset=UTF-8';
        $data = '{"message":"' . $msg . '","latE6":' . $this->conf['latE6'] . ',"lngE6":' . $this->conf['lngE6'] . ',"tab":"faction","v":"' . $this->conf['v'] . '"}';
        $info = $this->curl($url, $data, $header);
        if ($info['status'] != 200) {
            return false;
        }
        $arr = json_decode($info['info'], true);
        if (empty($arr['result'])) {
            return false;
        } else {
            return $arr['result'];
        }
    }
    //给萌新发消息
    public function auto_send_msg_new_agent()
    {
        $msg = $this->get_msg();
        if (!$msg) {
            return 'get message error';
        }
        $arr = json_decode($msg, true);
        if (!$arr) {
            return 'message decode error';
        }
        if (empty($arr['result']) || !is_array($arr['result'])) {
            return 'not new message';
        }
        $agents = '';
        $values = array();
        foreach ($arr['result'] as $value) {
            if ($agent = $this->check_new_agent($value[2]['plext']['text'])) {
                $values[] = '("' . $agent . '",' . time() . ')';
                $agents .= '@' . $agent . ' ';
            }
        }
        if ($agents == '') {
            return 'not new agent';

        }
        if (($this->send_msg($agents . ' ' . $this->rand_msg())) != 'success') {
            return 'message send error';
        }
        $sql = 'INSERT INTO `user` (`agent`, `createtime`) VALUES ' . implode(', ', $values);
        if ($this->sqllite->exec($sql)) {
            return 'message send success,Info storage success';
        } else {
            return 'message send success,Info storage error';
        }
    }
    //是不是萌新
    private function check_new_agent($msg = '')
    {
        if (preg_match('/\[secure\]\s+(\w+):\s+has completed training\.?/sim', $msg, $match)) {
            if (count($match) != 2) {
                return false;
            }
            $sql = 'SELECT COUNT(`id`) FROM `user` WHERE `agent`="' . $match[1] . '"';
            if ($this->sqllite->querySingle($sql) >= 1) {
                return false;
            } else {
                return $match[1];
            }
        } else if (preg_match('/\[secure\]\s(\w+):\s+.*/sim', $msg, $match)) {
            if (count($match) != 2) {
                return false;
            }
            if (!preg_match('/(我是萌新|新人求带|新人求罩|大佬们求带|求组织|带带我)/sim', $match[0])) {
                return false;
            }
            $sql = 'SELECT COUNT(`id`) FROM `user` WHERE `agent`="' . $match[1] . '"';
            if ($this->sqllite->querySingle($sql) > 0) {
                return false;
            } else {
                return $match[1];
            }
        } else {
            return false;
        }
    }
    //随机消息
    private function rand_msg()
    {
        if (empty($this->conf['rand_msg'])) {
            $data = array(
                ' 欢迎新人，快来加入川渝蓝军群(群号126821831)，发现精彩内容。',
                ' 欢迎选择加入抵抗军·川渝蓝军群(群号126821831)，一起为建设社会主义社会、实现人类的全面自由发展而奋斗吧',
                ' 您已进入秋名山路段，此处常有老司机出没，加入川渝蓝军群(群号126821831)，寻找这里的老司机吧',
                ' 欢迎加入熊猫抵抗军(群号126821831)，感谢你在与shapers的斗争中选择了人性与救赎，选择与死磕并肩同行。新人你好，我是死磕。',
                ' ingrees亚洲 中国分区 川渝地区组织需要你！快来加入川渝蓝军群(群号126821831)',
            );
        } else {
            $data = $this->conf['rand_msg'];
        }
        return $data[rand(0, count($data) - 1)];
    }

    /**
     * [check_conf 检测conf配置]
     * @Author    ZiShang520@gmail.com
     * @DateTime  2016-08-17T15:14:51+0800
     * @copyright (c)                      ZiShang520    All Rights Reserved
     * @return    [type]                   [description]
     */
    private function check_conf()
    {
        if (empty($this->conf['cookie'])) {
            exit('Conf.json Cookie Not Set');
        }
        if (empty($this->conf['x-csrftoken'])) {
            exit('Conf.json x-csrftoken Not Set');
        }
        if (empty($this->conf['UA'])) {
            exit('Conf.json UA Not Set');
        }
        if (empty($this->conf['v'])) {
            exit('Conf.json v Not Set');
        }
        if (empty($this->conf['minLatE6'])) {
            exit('Conf.json minLatE6 Not Set');
        }
        if (empty($this->conf['minLngE6'])) {
            exit('Conf.json minLngE6" Not Set');
        }
        if (empty($this->conf['maxLatE6'])) {
            exit('Conf.json maxLatE6 Not Set');
        }
        if (empty($this->conf['maxLngE6'])) {
            exit('Conf.json maxLngE6 Not Set');
        }
        if (empty($this->conf['latE6'])) {
            exit('Conf.json latE6 Not Set');
        }
        if (empty($this->conf['lngE6'])) {
            exit('Conf.json lngE6 Not Set');
        }
    }
    public function test()
    {
        $status = $this->curl('https://www.ingress.com/intel', null, array(), true);
        return $status;
    }
    //析构函数
    public function __destruct()
    {
        $this->sqllite->close();
    }
}
$a = new ingress(16);
print_r($a->test());
// echo $a->auto_send_msg_new_agent();
