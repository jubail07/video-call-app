exports.getHome = async(req, res)=>{
    try {
        return res.render('home')
    } catch (error) {
        console.log(error,'error in get home')
    }
}