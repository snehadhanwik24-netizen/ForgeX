const API_URL = "http://localhost:5000/api";

const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("forgex_token")}`
});

export const fetchDashboardRepositories = async () => {
    const response = await fetch(`${API_URL}/repositories`, {
        method: "GET",
        headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to fetch repositories");
    }

    return data;
};

export const fetchDashboardStats = async () => {
    const response = await fetch(
        `${API_URL}/version-control/dashboard/stats`,
        {
            method: "GET",
            headers: getHeaders()
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to fetch dashboard statistics");
    }

    return data;
};
