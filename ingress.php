<?php

/**
 * ingress
 */
class ingress
{
    // Request Header
    private $header = array();
    // Whether to open SSL
    public $ssl = true;
    // Load message last time (min)
    private $mintime;
    // Database connection
    private $sqllite;
    // configuration file
    private $conf;
    // Cookie file name
    private $cookie_file = 'cookie.ini';

    /**
     * [__construct description]
     * @Author    ZiShang520@gmail.com
     * @DateTime  2016-09-19T12:14:55+0800
     * @copyright (c)                      ZiShang520 All           Rights Reserved
     * @param     integer                  $mintime   [Load message last time (min)]
     */
    public function __construct($mintime = 10)
    {
        $this->sqllite = new SQLite3('agent.db', SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
        file_exists('conf.json') || exit('conf.json Not Found');
        $conf = file_get_contents('conf.json');
        $conf = json_decode(preg_replace('/((\r|\n|^\s*)+(\/\/[^\n]*|(\/\*([^\*^\/]*|[\*^\/\*]*|[^\**\/]*)*\*\/)*)|\r|\n|^\s+|\s+$)*/sim', '', $conf), true);
        $this->conf = $conf ? $conf : array();
        $this->check_conf();
        $this->mintime = $mintime;
        $this->header = array(
            'Cache-Control' => 'Cache-Control: max-age=0',
            'User-Agent' => 'User-Agent: ' . $this->conf['UA'],
            'Upgrade-Insecure-Requests' => '1',
            'Accept:' => 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language' => 'Accept-Language: zh-CN,zh;q=0.8',
            'Origin' => 'Origin: https://www.ingress.com',
            'Referer' => 'Referer: https://www.ingress.com/intel',
            'X-CSRFToken' => 'X-CSRFToken: ' . $this->conf['x-csrftoken'],
        );
    }

    /**
     * [curl description]
     * @Author    ZiShang520@gmail.com
     * @DateTime  2016-09-19T12:15:19+0800
     * @copyright (c)                      ZiShang520 All           Rights Reserved
     * @param     [type]                   $url       [request url]
     * @param     [type]                   $post      [post data]
     * @param     array                    $header    [header]
     * @param     boolean                  $cookie    [auto save cookie]
     * @return    [type]                              [curl exec data]
     */
    protected function curl($url, $post = null, $header = array(), $cookie = true)
    {
        $header = array_merge_recursive($this->header, $header);
        $data = array();
        $ch = curl_init();
        curl_setopt_array($ch,
            array(
                CURLOPT_URL => $url, //Request Url
                // CURLOPT_PROXY => 'http://127.0.0.1:8080', // HTTPS could not run
                CURLOPT_HTTPHEADER => $header, //Set Request Header
                CURLOPT_AUTOREFERER => true, // Open Auto Referer
                CURLOPT_FOLLOWLOCATION => true, //Open Auto Location
                CURLOPT_COOKIE => $this->conf['cookie'], //Set Cookie
                CURLOPT_TIMEOUT => 30, //Set Timeout
                CURLOPT_RETURNTRANSFER => true, //Set Not Show Response Headers
                CURLOPT_HEADER => false, //Set Not Output Header
                CURLOPT_NOBODY => false, //Set Not Show Body
            )
        );
        if (!empty($post)) {
            $post = is_array($post) ? http_build_query($post) : $post;
            curl_setopt_array($ch,
                array(
                    CURLOPT_POST => true, //Post request
                    CURLOPT_POSTFIELDS => $post,
                )
            );
        }
        if ($this->ssl) {
            // Check whether the domain name is set in the certificate, and whether the match is provided with the host name.
            curl_setopt_array($ch,
                array(
                    CURLOPT_SSL_VERIFYPEER => true, // Only trust the certificate issued by CA
                    CURLOPT_CAINFO => __DIR__ . '/cacert.pem', // CA root certificate (used to verify whether the site certificate is issued by the CA)
                    CURLOPT_SSL_VERIFYHOST => 2,
                )
            );
        }
        if ($cookie) {
            curl_setopt_array($ch,
                array(
                    CURLOPT_COOKIEJAR => $this->cookie_file, //Storing cookie information
                    CURLOPT_COOKIEFILE => $this->cookie_file, // use cookie
                )
            );
        }
        $data['info'] = curl_exec($ch);
        $data['status'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $data;
    }
    //Get message
    public function get_msg()
    {
        $url = 'https://www.ingress.com/r/getPlexts';
        $header['content-type'] = 'content-type:application/json; charset=UTF-8';
        $data = '{"minLatE6":' . $this->conf['minLatE6'] . ',"minLngE6":' . $this->conf['minLngE6'] . ',"maxLatE6":' . $this->conf['maxLatE6'] . ',"maxLngE6":' . $this->conf['maxLngE6'] . ',"minTimestampMs":' . intval(microtime(true) * 1000 - 60000 * $this->mintime) . ',"maxTimestampMs":-1,"tab":"faction","ascendingTimestampOrder":true,"v":"' . $this->conf['v'] . '"}';
        var_dump($data);
        $info = $this->curl($url, $data, $header);
        if ($info['status'] != 200) {
            return false;
        }
        return $info['info'];
    }
    //send message
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
    // Passcode automatic exchange
    public function auto_passcode($code)
    {
        $url = 'https://www.ingress.com/r/redeemReward';
        $header['content-type'] = 'content-type:application/json; charset=UTF-8';
        $data = '{"passcode":"' . $code . '","v":"' . $this->conf['v'] . '"}';
        $info = $this->curl($url, $data, $header);
        if ($info['status'] != 200) {
            return false;
        }
        return json_decode($info['info'], true);
    }
    //给萌新发消息
    public function auto_send_msg_new_agent()
    {
        $msg = $this->get_msg();
        if (!$msg) {
            return 'get message error';
        }
        if (!$arr = json_decode($msg, true)) {
            return 'message decode error';
        }
        if (empty($arr['result']) || !is_array($arr['result'])) {
            return 'not new message';
        }
        $agents = '';
        $values = array();
        foreach ($arr['result'] as $value) {
            var_dump($value[2]['plext']['text']);
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
                ' Welcome newcomers, Come join the Sichuan-Chengdu Blue Army group (group number 126821831), found exciting content.',
                ' 欢迎选择加入抵抗军·川渝蓝军群(群号126821831)，一起为建设社会主义社会、实现人类的全面自由发展而奋斗吧。',
                ' Welcome to join the Resistance Army · Sichuan-Chengdu Blue Army group (group number 126821831), together for the building of a socialist society, to achieve the full freedom of human development and struggle.',
                ' 您已进入秋名山路段，此处常有老司机出没，加入川渝蓝军群(群号126821831)，寻找这里的老司机吧。',
                ' You have entered the Autumn Hill section, where the old drivers often come and go, join the Sichuan-Chengdu Blue Army group (group number 126821831), looking for the old driver here.',
                ' 欢迎加入熊猫抵抗军(群号126821831)，感谢你在与shapers的斗争中选择了人性与救赎，选择与死磕并肩同行。新人你好，我是死磕。',
                ' Welcome to join the Panda Resistance Army (group number 126821831), thank you in the struggle with the shapers of choice of human nature and redemption, choose to walk side by side with the Sike. Hello new, I was Sike.',
                ' ingrees亚洲 中国分区 川渝地区组织需要你！快来加入川渝蓝军群(群号126821831)。',
                ' Ingrees Asia Chinese partition in Sichuan and Chengdu area organization needs you! Come and join the group of Sichuan and Chengdu (No. 126821831).',
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
    //析构函数
    public function __destruct()
    {
        $this->sqllite->close();
    }
}
