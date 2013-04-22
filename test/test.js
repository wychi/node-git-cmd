
var repo_path = '';
var branch1 = '';
var branch2 = '';

var log4js = require('log4js');
var logger = log4js.getLogger();

var Repo = require('../lib/git.js').Repo;

var assert = require("assert")
describe('Repo', function () {
    var repo = new Repo(repo_path);

    it('should list all branches', function(done) {
        repo.branches(function (err, branches) {
            assert.ifError(err);
            assert(branches.length > 0);
            done();
        });
    });

    it('should show commits of given branch', function(done) {
        repo.branch(branch1, function (err, branch) {
            assert.ifError(err);
            assert(branch);

            branch.log({}, function (err, commits) {
                assert.ifError(err);
                assert(commits.length > 0);
                done();
            });
        });
    });

    it('should find common base of two branches', function (done) {
        repo.merge_base(branch1, branch2, function (err, sha) {
            assert.ifError(err);
            assert(sha)
            done();
        });
    });

    it('should return details of a commit', function (done) {
        repo.merge_base(branch1, branch2, function (err, sha) {
            assert.ifError(err);
            assert(sha)

            repo.getCommit(sha, function (err, commit) {
                assert.ifError(err);
                assert(commit);

                assert.equal(sha, commit.sha);
                logger.debug(commit);
                done();
            });
        });
    });
});
