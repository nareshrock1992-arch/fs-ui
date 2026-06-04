const express=require('express');

const bcrypt=require('bcrypt');

const fs=require('fs');

const router=express.Router();

router.post('/login',async(req,res)=>{

const {username,password}=req.body;

const users=JSON.parse(

fs.readFileSync(
'./data/users.json'
)

);

const user=users.find(
u=>u.username===username
);

if(!user){

return res.status(401)
.json({
success:false
});

}

const ok=
await bcrypt.compare(
password,
user.password
);

if(!ok){

return res.status(401)
.json({
success:false
});

}

req.session.user=username;

res.json({

success:true

});

});

router.post('/logout',(req,res)=>{

req.session.destroy(()=>{

res.json({

success:true

});

});

});

module.exports=router;
