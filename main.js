const express = require('express')
const app = express()
const path = require('path')
const port = 3000

const axios = require('axios').default

app.use(express.static('public'))
app.set("view engine", "pug")
app.set("views", path.join(__dirname, "views"))

const getAccessToken = async function(email, password) {
    var response = await axios.post('https://cognito-idp.us-east-1.amazonaws.com/',
        `{"AuthFlow":"USER_PASSWORD_AUTH","ClientId":"3ck15a1ov4f0d3o97vs3tbjb52","AuthParameters":{"USERNAME":"${email}","PASSWORD":"${password}","DEVICE_KEY":"us-east-1_a6ea1c0b-e643-41a2-9d79-791f3677f65c"},"ClientMetadata":{}}`, {
        headers: {
            'x-amz-target': 'AWSCognitoIdentityProviderService.InitiateAuth',
            'x-amz-user-agent': 'aws-amplify/0.1.x js',
            'sec-ch-ua': '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
            'content-type': 'application/x-amz-json-1.1'
        }
    })
    
    let accessToken = response.data.AuthenticationResult.AccessToken

    if(accessToken == null) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');

    return accessToken;
}
const getCookie = async (accessToken) => {
    let response = await axios.get('https://www.flickr.com/signin/auth', {
        withCredentials: true,
        params: {
            'data': accessToken,
        },
        maxRedirects: 0,
        validateStatus: function (status) {
            return status >= 200 && status < 303;
        },

    })

    let setcookies = response.headers["set-cookie"];
    let cookies = setcookies.map((value, index) => {
        return value.split(';')[0];
    }).join('; ')

    return cookies;
}
const getCSRF = async (cookies) => {
    var response = await axios.get('https://www.flickr.com', {
        headers: {
            Cookie: cookies
        }
    })

    let csrf = /true,"csrf":"(.+?)"/.exec(response.data)[1];
    let api_key = /site_key":"(.+?)"/.exec(response.data)[1];

    return {csrf, api_key};
}

const getAlbum = async (link, cookie, csrf, api_key, perpage = 50) => {
    var result = /https:\/\/flickr.com\/photos\/[\w@]+\/albums\/(\d+)\/?/.exec(link)
    
    let photoset_id = result[1];

    let response = await axios.get(
        'https://api.flickr.com/services/rest',
        {
            params: {
                extras: 'can_addmeta,can_comment,can_download,can_print,can_share,contact,count_comments,count_faves,count_views,date_taken,date_upload,description,icon_urls_deep,isfavorite,ispro,license,media,needs_interstitial,owner_name,owner_datecreate,path_alias,perm_print,realname,rotation,safety_level,secret_k,secret_h,url_sq,url_q,url_t,url_s,url_n,url_w,url_m,url_z,url_c,url_l,url_h,url_k,url_3k,url_4k,url_f,url_5k,url_6k,url_o,visibility,visibility_source,o_dims,publiceditability,system_moderation',
                perpage: perpage,
                page: '1',
                get_user_info: '1',
                primary_photo_extras: 'url_c, url_h, url_k, url_l, url_m, url_n, url_o, url_q, url_s, url_sq, url_t, url_z, needs_interstitial, can_share',
                jump_to: '',
                photoset_id: photoset_id,
                viewerNSID: '191856489@N08',
                method: 'flickr.photosets.getPhotos',
                csrf: csrf,
                api_key: api_key,
                format: 'json',
                hermes: '1',
                hermesclient: '1',
                reqid: 'cc775256',
                nojsoncallback: '1'
            },
            headers: {
                Cookie: cookie
            }
        }
    );

    return response;
} 

app.get('/get-link/', (req, res) => {
    //TODO: check if url is valid
    //https://flickr.com/photos/51838687@N07/albums/72157715285724358

    let { link, username, password } = req.query;
    if(false == /https:\/\/flickr.com\/photos\/[\w@]+\/albums\/\d+\/?/.test(link)) {
        res.json({success: false, "error": "Link không hợp lệ"})
        return
    }
    
    if(!username || !password) return {
        res.json({success: false, "error": "missing_parametters"});
        return
    }
    
    let accessToken
    
    getAccessToken(username, password).then((value) => {
        accessToken = value

        getCookie(accessToken).then((cookie) => {

            getCSRF(cookie).then((data) => {

                let { csrf, api_key } = data 

                getAlbum(link, cookie, csrf, api_key).then((response) => {
                    res.json(response.data.photoset)
                })
            })
        })
    })

})

app.get('/', (req, res) => {
    res.render('homepage');
})

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`)
})
