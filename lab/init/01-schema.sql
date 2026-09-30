USE `sqforgelab`;

CREATE TABLE st1_members (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(64), pw VARCHAR(128));
INSERT INTO st1_members (user, pw) VALUES ('admin', 'adminpass'), ('guest', 'guestpass'), ('test', 'testpass');
CREATE TABLE st1_secret (flag VARCHAR(128));
INSERT INTO st1_secret VALUES ('flag{un10n_1s_e4sy}');

CREATE TABLE st2_members (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(64), pw VARCHAR(128));
INSERT INTO st2_members (user, pw) VALUES ('admin', 'adminpass'), ('guest', 'guestpass');
CREATE TABLE st2_secret (flag VARCHAR(128));
INSERT INTO st2_secret VALUES ('flag{sp4ce_1s_g0ne}');

CREATE TABLE st3_members (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(64), pw VARCHAR(128)) CHARSET=gbk;
INSERT INTO st3_members (user, pw) VALUES ('admin', 'flag{gbk_w1de_byt3}'), ('guest', 'guestpass');

CREATE TABLE st4_members (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(64), pw VARCHAR(128));
INSERT INTO st4_members (user, pw) VALUES ('admin', 'flag{b00lean_bl1nd}'), ('guest', 'guestpass'), ('tester', 'test123');

CREATE TABLE st5_members (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(64), pw VARCHAR(128));
INSERT INTO st5_members (user, pw) VALUES ('admin', 'flag{t1me_bl1nd}'), ('guest', 'guestpass');
