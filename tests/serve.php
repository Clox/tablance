<?php
header('Access-Control-Allow-Origin: *');
ini_set("post_max_size", "100M");
ini_set("upload_max_filesize", "100M");
ini_set("memory_limit", "20000M"); 


if(empty($_FILES)){
	phpinfo();
}