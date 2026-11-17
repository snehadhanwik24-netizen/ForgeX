const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

const {
    createPullRequest,
    getPullRequests,
    getPullRequest,
    closePullRequest,
    getPullRequestComparison,
    assignPullRequestReviewers,
    submitPullRequestReview
} = require("../controllers/pullRequestController");

router.use(protect);

router.param("repositoryId", validateObjectId("repository ID"));
router.param("id", validateObjectId("pull request ID"));

router.post("/", createPullRequest);
router.get("/repository/:repositoryId", getPullRequests);
router.patch("/:id/reviewers", assignPullRequestReviewers);
router.post("/:id/reviews", submitPullRequestReview);
router.get("/:id/compare", getPullRequestComparison);
router.get("/:id", getPullRequest);
router.patch("/:id/close", closePullRequest);

module.exports = router;



