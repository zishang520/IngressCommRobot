#Ingress Comm Automatically send message

###Tips: PHP version



Add the file run.php to the scheduled task or service monitor, for 15 minutes

#####run service
PHP5.4+ needs SQLite3 extensions

run

```php
php run.php
```

---------------------------------------
###Tips: Nodejs version

Add the file run.js to the scheduled task, for 15 minutes

#####run service

Required modules: request, SQLite3, tough-cookie-filestore

```npm
npm install request --save
npm install sqlite3 --save
```

Original 'tough-cookie-filestore' problem, please use my modified 'tough-cookie-filestore'

```npm
npm install https://github.com/zishang520/tough-cookie-filestore.git --save
```

run

```nodejs
nodejs run.js
```

---------------------------------------
###Configuration Information:

service/data/conf.json.default modify the configuration and renamed conf.json