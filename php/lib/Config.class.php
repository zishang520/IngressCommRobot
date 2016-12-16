<?php
/**
 * Config
 */
class Config
{
    // 内容
    private $info;
    // 文件
    private $file;

    public function __construct($file = '')
    {
        if ($file == '') {
            throw new Exception('argment file is empty');
        }
        $this->file = $file;
        if (file_exists($file)) {
            $info = require $this->file;
        } else {
            $info = [];
        }
        $this->info = !empty($info) && is_array($info) ? $info : [];
    }
    // 设置值
    public function set($name = null, $value = null)
    {
        if (func_num_args() == 1) {
            $value = is_array($name) ? $name : [];
            $this->info = array_merge($this->info, $value);
        } else if (func_num_args() == 2) {
            if (!is_scalar($name) || !is_scalar($value)) {
                throw new Exception('do you argments is scalar?');
            }
            $this->info[$name] = $value;
        } else {
            throw new Exception('argments error');
        }
        return true;
    }
    // 删除指定键名
    public function del($name = '')
    {
        if ($name == '') {
            throw new Exception('name is empty');
        }
        unset($this->info[$name]);
        return true;
    }
    // 清空
    public function clear()
    {
        $this->info = [];
        return true;
    }
    // 获取指定键名
    public function get($name = '')
    {
        if ($name == '') {
            return $this->info;
        }
        return array_key_exists($name, $this->info) ? $this->info[$name] : null;
    }
    // 保存
    public function save()
    {
        $doc = "<?php\nreturn " . var_export($this->info, true) . ";";
        return (file_put_contents($this->file, $doc, LOCK_EX) === false) ? false : true;
    }
}
