app.post("/data", async (req, res) => {
    const msg = req.body.message;

    try {
        // 🔹 Check if value exists in Supabase
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/messages?message=eq.${msg}`,
            {
                method: "GET",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            }
        );

        const data = await response.json();

        if (data.length > 0) {
            console.log("Found:", msg);
            res.json({ reply: "FOUND in database" });
        } else {
            console.log("Not found:", msg);
            res.json({ reply: "NOT FOUND" });
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Error");
    }
});