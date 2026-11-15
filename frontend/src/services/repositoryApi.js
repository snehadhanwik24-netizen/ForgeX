const API_URL = "http://localhost:5000/api/repositories";

const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("forgex_token")}`
});

// Get all repositories
export const fetchRepositories = async () => {
    const response = await fetch(API_URL, {
        headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to fetch repositories");
    }

    return data;
};

// Create repository
export const createRepository = async (repositoryData) => {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(repositoryData)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to create repository");
    }

    return data;
};

// Delete repository
export const deleteRepository = async (repositoryId) => {
    const response = await fetch(`${API_URL}/${repositoryId}`, {
        method: "DELETE",
        headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to delete repository");
    }

    return data;
};
