
const { createClient } = require('@supabase/supabase-js');

// Config from .env
const SUPABASE_URL = 'https://vdeacxzqdbulgklfkqfs.supabase.co'; // Hardcoded from .env for simplicity in script
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZWFjeHpxZGJ1bGdrbGZrcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTAxMTgsImV4cCI6MjA4MDMyNjExOH0.NBSBiR-l0Itv-rhKXod8fAar2apdTbad4_qN4vyQdDM';

async function checkProvisional() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('Checking for provisional members...');

    const { data, error, count } = await supabase
        .from('members')
        .select('member_id, name, email, created_at', { count: 'exact' })
        .eq('status', 'provisional');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${count} provisional members.`);

    if (data && data.length > 0) {
        console.log('List of provisional members:');
        data.forEach(m => {
            console.log(`- [${m.member_id}] ${m.name} (${m.email}) - Created: ${m.created_at}`);
        });
    } else {
        console.log('No members are currently in provisional status.');
    }
}

checkProvisional();
