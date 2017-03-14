<?php
class JsObj
{
    const JSVAL_TEXT = 12001;
    const JSVAL_STRING = 12002;
    const JSVAL_REGEXP = 12003;
    const JSVAL_COMMT1 = 12004;
    const JSVAL_COMMT2 = 12005;
    private $fields;
    private $assoc = false;
    public function __construct($type, $assoc = false)
    {
        $this->assoc = $assoc;
        $this->fields = ($type == '[') || $this->assoc ? [] : new stdClass();
    }

    public function add_name(&$text)
    {
        $this->name = $text;
        $text = '';
    }
    public function add_value(&$text)
    {
        // weird input like a mix of fields and array elements will cause warnings here
        if (!isset($this->name)) {
            $this->fields[] = $text;
        } else {
            if ($this->assoc) {
                $this->fields[$this->name] = $text;
            } else {
                $this->fields->{$this->name} = $text;
            }
        }

        $text = '';
    }

    public static function decode($json, $assoc = false)
    {
        if ($msg = json_decode($json, $assoc)) {
            return $msg;
        }
        // parse a JS initializer
        $stack = [];
        $text = "";
        $state = self::JSVAL_TEXT;
        $len = strlen($json);
        for ($i = 0; $i != $len; $i++) {
            $c = $json[$i];
            switch ($state) {
                case self::JSVAL_TEXT:
                    switch ($c) {
                        case '{':
                        case '[':
                            array_unshift($stack, new self($c, $assoc));
                            break;
                        case '}':
                        case ']':
                            $stack[0]->add_value($text);
                            $text = array_shift($stack)->fields;
                            break;
                        case ':':
                            $stack[0]->add_name($text);
                            break;
                        case ',':
                            $stack[0]->add_value($text);
                            break;
                        case '"':
                        case "'":
                            $closer = $c;
                            $state = self::JSVAL_STRING;
                            break;
                        case '/':
                            assert($i != ($len - 1));
                            switch ($json[$i + 1]) {
                                case '/':
                                    $state = self::JSVAL_COMMT1;
                                    break;
                                case '*':
                                    $state = self::JSVAL_COMMT2;
                                    break;
                                default:
                                    $state = self::JSVAL_REGEXP;
                                    $text .= $c;
                            }
                            break;
                        case "\r":
                        case "\n":
                        case "\t":
                        case ' ':break;
                        default:
                            $text .= $c;
                    }
                    break;
                case self::JSVAL_STRING:
                    if ($c != $closer) {
                        $text .= $c;
                    } else {
                        $state = self::JSVAL_TEXT;
                    }

                    break;
                case self::JSVAL_REGEXP:
                    if (($c != ',') && ($c != '}')) {
                        $text .= $c;
                    } else {
                        $i--;
                        $state = self::JSVAL_TEXT;
                    }
                    break;
                case self::JSVAL_COMMT1:
                    if (($c == "\r") || ($c == "\n")) {
                        $state = self::JSVAL_TEXT;
                    }

                    break;
                case self::JSVAL_COMMT2:
                    if ($c != '*') {
                        break;
                    }

                    assert($i != ($len - 1));
                    if ($json[$i + 1] == '/') {
                        $i++;
                        $state = self::JSVAL_TEXT;
                    }
            }
        }
        assert($state == self::JSVAL_TEXT);
        return is_object($text) || is_array($text) ? $text : null;
    }
}