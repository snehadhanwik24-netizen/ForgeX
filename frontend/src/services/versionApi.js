const API_URL = "http://localhost:5000/api/repository-files";

const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("forgex_token")}`
});

// Get all previous versions of a file
export const fetchFileVersions = async (repositoryId, fileId) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/files/${fileId}/versions`,
        { headers: getHeaders() }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to fetch file versions");
    }

    return data;
};

// Restore a selected previous version
export const restoreFileVersion = async (
    repositoryId,
    fileId,
    versionNumber
) => {
    const response = await fetch(
        `${API_URL}/${repositoryId}/files/${fileId}/versions/${versionNumber}/restore`,
        {
            method: "POST",
            headers: getHeaders()
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to restore file version");
    }

    return data;
};
