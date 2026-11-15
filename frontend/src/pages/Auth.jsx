import { useState } from "react";
import { registerUser, loginUser } from "../services/api";

function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({
        name: "",
        username: "",
        email: "",
        password: ""
    });
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setLoading(true);

        try {
            let result;

            if (isLogin) {
                result = await loginUser({
                    email: form.email,
                    password: form.password
                });
            } else {
                result = await registerUser(form);
            }

            localStorage.setItem("forgex_token", result.token);
            localStorage.setItem("forgex_user", JSON.stringify(result.user));
            window.location.reload();

            setMessage(result.message);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="brand">
                    <div className="brand-icon">FX</div>
                    <h1>ForgeX</h1>
                    <p>Build. Collaborate. Ship.</p>
                </div>

                <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>
                <p className="subtitle">
                    {isLogin
                        ? "Sign in to continue to ForgeX"
                        : "Join your team and start building"}
                </p>

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <>
                            <label>Full name</label>
                            <input
                                name="name"
                                placeholder="Your name"
                                value={form.name}
                                onChange={handleChange}
                                required
                            />

                            <label>Username</label>
                            <input
                                name="username"
                                placeholder="Choose a username"
                                value={form.username}
                                onChange={handleChange}
                                required
                            />
                        </>
                    )}

                    <label>Email address</label>
                    <input
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={handleChange}
                        required
                    />

                    <label>Password</label>
                    <input
                        type="password"
                        name="password"
                        placeholder="At least 8 characters"
                        value={form.password}
                        onChange={handleChange}
                        minLength={8}
                        required
                    />

                    <button type="submit" disabled={loading}>
                        {loading
                            ? "Please wait..."
                            : isLogin
                                ? "Sign in"
                                : "Create account"}
                    </button>
                </form>

                {message && <div className="auth-message">{message}</div>}

                <div className="auth-switch">
                    {isLogin
                        ? "New to ForgeX? "
                        : "Already have an account? "}

                    <span onClick={() => {
                        setIsLogin(!isLogin);
                        setMessage("");
                    }}>
                        {isLogin ? "Create an account" : "Sign in"}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default Auth;

