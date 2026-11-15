const API_URL = "http://localhost:5000/api/repository-files";

const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("forgex_token")}`
});

// Get files from the repository root or a selected folder
export const fetchRepositoryFiles = async (repositoryId, folderPath = "") => {
    const query = folderPath
        ? `?path=${encodeURIComponent(folderPath)}`
        : "";

    const response = await fetch(
        `${API_URL}/${repositoryId}/files${query}`,
        { headers: getHeaders() }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to load files");
    }

    return data;
};

// Create a file or folder
export const createRepositoryFile = async (repositoryId, fileData) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/files`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(fileData)
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "File creation failed");
    }

    return data;
};

// Update file contents
export const updateRepositoryFile = async (repositoryId, fileId, content) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/files/${fileId}`,
        {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify({ content })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "File update failed");
    }

    return data;
};

// Delete a file or folder
export const deleteRepositoryFile = async (repositoryId, fileId) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/files/${fileId}`,
        {
            method: "DELETE",
            headers: getHeaders()
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "File deletion failed");
    }

    return data;
};
