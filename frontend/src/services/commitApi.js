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


// Merge a source branch into the active branch
export const mergeRepositoryBranch = async (
    repositoryId,
    sourceBranch,
    message
) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/merge`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ sourceBranch, message })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.message || "Failed to merge branches");
        error.conflicts = data.conflicts || [];
        error.dirtyFiles = data.dirtyFiles || [];
        throw error;
    }

    return data;
};


// Retrieve base, target and source versions of conflicting files.
export const fetchConflictDetails = async (repositoryId, sourceBranch) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/conflicts`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ sourceBranch })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to retrieve conflict details");
    }

    return data;
};

// Submit manually resolved files and complete the merge.
export const resolveRepositoryConflicts = async (
    repositoryId,
    sourceBranch,
    resolvedFiles,
    message
) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/resolve-conflicts`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
                sourceBranch,
                resolvedFiles,
                message
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(
            data.message || "Failed to resolve conflicts"
        );
        error.details = data.error;
        throw error;
    }

    return data;
};

// ForgeX history operations: revert, cherry-pick, tags and releases.
async function historyRequest(repositoryId, endpoint, options = {}) {
    if (!repositoryId) throw new Error("Select a repository first");

    const response = await fetch(
        `${API_URL}/${repositoryId}/${endpoint}`,
        {
            ...options,
            headers: {
                ...getHeaders(),
                ...(options.headers || {})
            }
        }
    );

    const rawResponse = await response.text();
    let result;

    try {
        result = JSON.parse(rawResponse);
    } catch {
        const preview = rawResponse.slice(0, 250).replace(/\s+/g, " ");
        throw new Error(
            `API returned non-JSON response (HTTP ${response.status}): ${preview || "Empty response"}`
        );
    }

    if (!response.ok || result.success === false) {
        const error = new Error(result.message || "Request failed");
        error.status = response.status;
        error.conflicts = result.conflicts || [];
        throw error;
    }

    return result.data;
}

export async function revertRepositoryCommit(repositoryId, payload) {
    return historyRequest(repositoryId, "revert", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

export async function cherryPickRepositoryCommit(repositoryId, payload) {
    return historyRequest(repositoryId, "cherry-pick", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

export async function fetchRepositoryTags(repositoryId) {
    return historyRequest(repositoryId, "tags");
}

export async function createRepositoryTag(repositoryId, payload) {
    return historyRequest(repositoryId, "tags", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

export async function fetchRepositoryReleases(repositoryId) {
    return historyRequest(repositoryId, "releases");
}

export async function createRepositoryRelease(repositoryId, payload) {
    return historyRequest(repositoryId, "releases", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}
