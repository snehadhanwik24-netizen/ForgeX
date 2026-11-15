const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

const {
    createRepository,
    getRepositories,
    getRepository,
    deleteRepository
} = require("../controllers/repositoryController");

router.use(protect);

router.param("id", validateObjectId("repository ID"));

router.post("/", createRepository);
router.get("/", getRepositories);
router.get("/:id", getRepository);
router.delete("/:id", deleteRepository);

module.exports = router;
