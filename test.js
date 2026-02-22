const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vryyyyivmbbqahlaafdn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeXl5eWl2bWJicWFobGFhZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTU4MzMsImV4cCI6MjA4NzE5MTgzM30.CuBBkWyFSh9vpIYX5CdgZ01qH3YkTIdl-ewOQcmVa3U'
);

async function run() {
    const userTags = ["第1梯"];
    let fetchAccessQuery = supabase
        .from('chapter_access')
        .select('subject, chapter');

    if (userTags.length > 0) {
        const tagConditions = userTags.map(tag => `allowed_tags.cs.[${JSON.stringify(tag)}]`).join(',');
        fetchAccessQuery = fetchAccessQuery.or(`is_public.eq.true,${tagConditions}`);
    } else {
        fetchAccessQuery = fetchAccessQuery.eq('is_public', true);
    }
    const { data: accessibleChapters, error: accessError } = await fetchAccessQuery;
    console.log("accessibleChapters:", accessibleChapters, accessError);
}

run();
