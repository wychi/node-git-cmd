"use strict";

var _ = require('underscore');
var assert = require('assert');
var log4js = require('log4js');
var logger = log4js.getLogger("node-git-cmd");
logger.setLevel('ERROR');

var git_exec = function (git_cmd, ctx, callback) {
    logger.debug('git_exec', git_cmd, ctx);

    var spawn = require('child_process').spawn;
    var tokens = git_cmd.split(' '),
        cmd = tokens.shift(),
        params = tokens,
        git = spawn(cmd, params, ctx),
        stdout = '',
        stderr = '';

    git.stdout.on('data', function (data) {
        stdout += data;
    });
    git.stderr.on('data', function (data) {
        stderr += data;
    });
    git.on('close', function (code) {
        logger.debug(git_cmd, cmd, params, 'exit code', code);
        var err;
        if (code !== 0) {
            err = {};
            err.code = code;
            err.cmd = git_cmd;
            err.msg = stderr;

            logger.error("git_exec", err);
        }

        callback(err, stdout);
    });
};

function parseGitLog(stdout) {
    if(stdout.length == 0) return [];
    var lines = stdout.split('\n');
    var body = '';
    var commits = [];
    var commit;
    _.each(lines, function (line) {
        var result = line.match(/^commit (\w+)/);
        if(result) {
            logger.verbose('found commit');
            if(commit) {
                logger.verbose('found commit', commit);
                commits.push(commit);
            }
            commit = {};
            commit.sha = result[1];
            commit.body = '';
            return;
        }

        if ( commit=== undefined) {
            logger.error('[parseGitLog] unexpected', line);
            return;
        }

        result = line.match(/^Author:( +)(.*) <(.*)>/);
        if(result) {
            commit['Author'] = result[2];
            commit['email'] = result[3];
            return;
        }
        result = line.match(/^Date:( +)(.*)/);
        if(result) {
            commit['Date'] = new Date(result[2]);
            return;
        }

        result = line.match(/^    (.*)/);
        if (result) {
            commit.body += result[1] + '\n';
            if (!commit.title) commit.title = result[1];

            result = line.match(/^    Change-Id: (\w+)/);
            if (result)
                commit.change_id = result[1];

            return;
        }
    });
    if(commit) {
        commits.push(commit);
    }

    return commits;
}

var Repo = function (path, subfolder) {
    var obj = {};
    obj.cwd = path;
    if (subfolder) obj.subfolder = subfolder;

    this.ctx = obj;
};

var Branch = function (obj) {
    if (obj) {
        _.extend(this, obj);
    }
};

var Commit = function (obj) {
    if (obj) {
        _.extend(this, obj);
    }
};

Repo.prototype.branches = function (callback) {
    var self = this;
    git_exec('git branch -a', self.ctx, function (err, data) {
        var lines = _.filter(data.split('\n'), function (item) { return item.length > 0; });
        var branches = _.map(lines, function (item) {
            var obj = {};
            obj.ctx = self.ctx;
            obj.branch = item.substring(2);
            return new Branch(obj);
        });
        callback(null, branches);
    });
};

Repo.prototype.branch = function (name, callback) {
    this.branches(function (err, branches) {
        if (err) {
            callback(err, null);
            return;
        }

        var branch = _.find(branches, function (item) {
            if(/^remotes/.test(item.branch)) {
                return item.branch.substring(8) === name;
            } else {
                return item.branch === name;
            }
        });

        if (branch === undefined) {
            err = {err: 'branch not found ' + name};
        }
        callback(err, branch);
    });
};

// return commit objects
Branch.prototype.log = function (opt, callback) {
    var self = this;
    var cmd = 'git log';
    opt = opt || {};
    //opt['-n'] = opt['-n'] || 3;
    var key;
    for (key in opt) {
        if (key==='oneline') {
            cmd += ' ' + opt[key];
        }
        else {
            cmd += ' ' + key + ' ' + opt[key];
        }
    }

    git_exec(cmd, self.ctx, function (err, data) {
        var commits = parseGitLog(data);
        _.each(commits, function (item) {
            item.ctx = self.ctx;
            item.branch = self.branch;
        });
        callback(null, commits);
    });
};

Repo.prototype.merge_base = function (b1, b2, callback) {
    var self = this;
    var b1_name = (typeof b1 === 'string') ? b1 : b1.branch;
    var b2_name = (typeof b2 === 'string') ? b2 : b2.branch;

    var cmd = 'git merge-base ' + b1_name + ' ' + b2_name;
    git_exec(cmd, self.ctx, function (err, data) {
        if (err) { return callback(err, undefined); }
        callback(null, data.split('\n')[0]);
    });
};

Repo.prototype.getCommit = function(sha, callback) {
    var self = this;
    var cmd = 'git log -n 1 ' + sha;
    git_exec(cmd, self.ctx, function (err, data) {
        logger.debug(err, data);
        var commits = parseGitLog(data, self.ctx);
        callback(undefined, commits[0]);
    });
};

exports.Repo = Repo;
exports.Branch = Branch;
exports.Commit = Commit;
