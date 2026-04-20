const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'smartseason.db');
const db = new sqlite3.Database(dbPath);

const seedData = async () => {
    console.log('Seeding database...');
    try {
        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`,
                ['admin@smartseason.com', adminPassword, 'System Administrator', 'admin'],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID || 1);
                }
            );
        });
        
        // Create field agents
        const agentPassword = await bcrypt.hash('agent123', 10);
        
        const agents = [
            { email: 'agent1@smartseason.com', name: 'John Smith' },
            { email: 'agent2@smartseason.com', name: 'Sarah Johnson' },
            { email: 'agent3@smartseason.com', name: 'Mike Davis' }
        ];
        
        const agentIds = [];
        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            const id = await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`,
                    [agent.email, agentPassword, agent.name, 'field_agent'],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID || (i + 2));
                    }
                );
            });
            agentIds.push(id);
        }
        
        // Create sample fields
        const today = new Date();
        const fields = [
            {
                name: 'North Field - Corn',
                crop_type: 'Corn',
                planting_date: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
                current_stage: 'growing',
                agent_index: 0
            },
            {
                name: 'South Field - Wheat',
                crop_type: 'Wheat',
                planting_date: new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
                current_stage: 'ready',
                agent_index: 0
            },
            {
                name: 'East Field - Soybeans',
                crop_type: 'Soybeans',
                planting_date: new Date(today.getTime() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
                current_stage: 'growing',
                agent_index: 1
            },
            {
                name: 'West Field - Barley',
                crop_type: 'Barley',
                planting_date: new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000), // 180 days ago (harvested)
                current_stage: 'harvested',
                agent_index: 1
            },
            {
                name: 'Central Field - Tomatoes',
                crop_type: 'Tomatoes',
                planting_date: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
                current_stage: 'planted',
                agent_index: 2
            },
            {
                name: 'River Field - Rice',
                crop_type: 'Rice',
                planting_date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago (at risk)
                current_stage: 'planted',
                agent_index: 2
            }
        ];
        
        for (const field of fields) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO fields (name, crop_type, planting_date, current_stage, assigned_agent_id) VALUES (?, ?, ?, ?, ?)`,
                    [
                        field.name,
                        field.crop_type,
                        field.planting_date.toISOString().split('T')[0],
                        field.current_stage,
                        agentIds[field.agent_index] || null
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        
        // Add some sample updates
        const fieldIds = await new Promise((resolve, reject) => {
            db.all('SELECT id, current_stage FROM fields LIMIT 6', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (let i = 0; i < fieldIds.length; i++) {
            const field = fieldIds[i];
            const agentId = agentIds[i % agentIds.length] || agentIds[0];
            
            // Add initial planting update
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO field_updates (field_id, agent_id, stage, notes) VALUES (?, ?, ?, ?)`,
                    [field.id, agentId, 'planted', 'Initial planting completed'],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            // Add progress updates for fields past planted stage
            if (field.current_stage !== 'planted') {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT OR IGNORE INTO field_updates (field_id, agent_id, stage, notes) VALUES (?, ?, ?, ?)`,
                        [field.id, agentId, 'growing', 'Crop is growing well, regular irrigation applied'],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            
            if (field.current_stage === 'ready' || field.current_stage === 'harvested') {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT OR IGNORE INTO field_updates (field_id, agent_id, stage, notes) VALUES (?, ?, ?, ?)`,
                        [field.id, agentId, 'ready', 'Crop is ready for harvest'],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            
            if (field.current_stage === 'harvested') {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT OR IGNORE INTO field_updates (field_id, agent_id, stage, notes) VALUES (?, ?, ?, ?)`,
                        [field.id, agentId, 'harvested', 'Harvest completed successfully'],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }
        
        console.log('Database seeded successfully');
        console.log('Demo credentials:');
        console.log('  Admin: admin@smartseason.com / admin123');
        console.log('  Agent: agent1@smartseason.com / agent123');
        console.log('  Agent: agent2@smartseason.com / agent123');
        console.log('  Agent: agent3@smartseason.com / agent123');
        
        db.close();
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        db.close();
        process.exit(1);
    }
};

seedData();
