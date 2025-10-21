const express = require('express');
                            VALUES (?, ?, CURRENT_TIMESTAMP)`
)
;
    
Object
.
entries
(
settings
)
.
forEach
(
(
[
key
, 
value
]
)
 => 
{
        
stmt
.
run
(
[
key
, 
value
]
)
;
    
}
)
;
    
stmt
.
finalize
(
)
;
    
res
.
json
(
{
 message
: 
'Settings updated successfully'
 
}
)
;
}
)
;
// EXPORT DATA
// Export creators as JSON
app
.
get
(
'/api/export/creators'
, 
authenticateToken
, 
requireAdmin
, 
(
req
, 
res
)
 => 
{
    
db
.
all
(
'SELECT * FROM creators ORDER BY is_featured DESC, display_name ASC'
, 
[
]
, 
(
err
, 
creators
)
 => 
{
        
if
 
(
err
)
 
{
            
return
 
res
.
status
(
500
)
.
json
(
{
 error
: 
'Database error'
 
}
)
;
        
}
        
// Parse platforms JSON for each creator
        
creators
.
forEach
(
creator
 => 
{
            
if
 
(
creator
.
platforms
)
 
{
                
try
 
{
                    
creator
.
platforms
 = 
JSON
.
parse
(
creator
.
platforms
)
;
                
}
 
catch
 
(
e
)
 
{
                    
creator
.
platforms
 = 
[
]
;
                
}
            
}
        
}
)
;
        
res
.
setHeader
(
'Content-Type'
, 
'application/json'
)
;
        
res
.
setHeader
(
'Content-Disposition'
, 
'attachment; filename=psycheverse-creators.json'
)
;
        
res
.
json
(
creators
)
;
    
}
)
;
}
)
;

app.get('/admin', (req, res) => {
  res.send('Welcome to the Psycheverse Admin Dashboard!');
});

// Start server
app
.
listen
(
PORT
, 
(
)
 => 
{
    
console
.
log
(
`🚀 Psycheverse Admin API running on port 
${
PORT
}
`
)
;
    
console
.
log
(
`📊 Admin Dashboard: http://localhost:
${
PORT
}
`
)
;
    
console
.
log
(
`🔑 Default login: admin / admin123`
)
;
}
)
;
module
.
exports
 = 
app
;
