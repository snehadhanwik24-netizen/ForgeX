const API_URL = "http://localhost:5000/api/version-control";

const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("forgex_token")}`
});

// Fetch commit history
export const fetchCommitHistory = async (repositoryId) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/history`,
        {
            method: "GET",
            headers: getHeaders()
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to fetch commit history");
    }

    return data;
};

// Create a new commit
export const createCommit = async (repositoryId, message) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/commit`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ message })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to create commit");
    }

    return data;
};

// Fetch branches
export const fetchBranches = async (repositoryId) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/branches`,
        { headers: getHeaders() }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to fetch branches");
    }

    return data;
};

// Create branch
export const createBranch = async (repositoryId, branchName) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/branches`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ branchName })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to create branch");
    }

    return data;
};

// Switch branch
export const switchBranch = async (repositoryId, branchName) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/branches/switch`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ branchName })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.message || "Failed to switch branch");
        error.dirtyFiles = data.dirtyFiles || [];
        throw error;
    }

    return data;
};

// Compare a file between two commits
export const fetchFileDiff = async (
    repositoryId,
    oldCommitId,
    newCommitId,
    filePath
) => {
    const params = new URLSearchParams({
        oldCommitId,
        newCommitId,
        filePath
    });

    const response = await fetch(
        `${API_URL}/${repositoryId}/diff?${params}`,
        { headers: getHeaders() }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to compare file versions");
    }

    return data;
};

// Fetch working tree status
export const fetchWorkingTreeStatus = async (repositoryId) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/status`,
        { headers: getHeaders() }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to fetch working tree status");
    }

    return data;
};

// Stage an existing repository file
export const stageRepositoryFile = async (repositoryId, fileId) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/stage/${fileId}`,
        { method: "POST", headers: getHeaders() }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to stage file");
    return data;
};

// Stage a deleted file
export const stageRepositoryDeletion = async (repositoryId, filePath) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/stage-deletion`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ filePath })
        }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to stage deletion");
    return data;
};

// Fetch staging area
export const fetchStagingStatus = async (repositoryId) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/staging`,
        { headers: getHeaders() }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to fetch staging area");
    return data;
};

// Unstage a file
export const unstageRepositoryFile = async (repositoryId, filePath) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/staging/file`,
        {
            method: "DELETE",
            headers: getHeaders(),
            body: JSON.stringify({ filePath })
        }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to unstage file");
    return data;
};

// Unstage a deletion
export const unstageRepositoryDeletion = async (repositoryId, filePath) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/staging/deletion`,
        {
            method: "DELETE",
            headers: getHeaders(),
            body: JSON.stringify({ filePath })
        }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to unstage deletion");
    return data;
};
