app.post('/api/signals', async (req, res) => {
  try {
    const { user_id, email, looking_for, help_with, location } = req.body;

    const { data, error } = await supabase
      .from('signals')
      .insert([{ user_id, email, looking_for, help_with, location }]);

    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
