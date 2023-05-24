/////////////////////////////
// LND custom backend (REST/gRPC) / webLN calls
/////////////////////////////

async function getclientpubkey() {
    
    // webLN
    if (webln_connection == true) {
        let response = await webln.request('getinfo');
        console.log(response);
        return response.identity_pubkey;
    } 
    
    // custom backend (REST/gRPC)
    else {
        let response = await fetch('/getinfo', { method: "POST" });
        let data = await JSON.parse(await response.json());
        console.log(data);
        return data.identity_pubkey;
    }
}


async function addholdinvoice(hash, value) {
    
    // webLN
    if (webln_connection == true) {
        let response = await webln.request('addholdinvoice',
        {
            hash: hash, 
            value: value
        });
        console.log('addholdinvoice response: ' + response.payment_request);
        return response.payment_request
    } 
    
    // custom backend (REST/gRPC)
    else {
        let request = {
            method: "POST",
            body: JSON.stringify({
                hash: hash, 
                value: value
            }),
            headers: {
                "Content-Type": "application/json"
            }
        };
        let response = await fetch('/addholdinvoice', request);
        let data = JSON.parse(await response.json());
        console.log('addholdinvoice response: ' + data.payment_request);
        return data.payment_request;
    }
}

async function lookupinvoice(payment_hash_in) {
    
    // webLN
    if (webln_connection == true) {
        let payment_hash_hex = [...atob(payment_hash_in)].map(c=> c.charCodeAt(0).toString(16).padStart(2,0)).join``
        console.log('payment_hash_in base64: ' + payment_hash_in);
        console.log('payment_hash_hex: ' + payment_hash_hex);
        let response = await webln.request('lookupinvoice',
        {
            r_hash_str: payment_hash_hex,
        })
        console.log('lookupinvoice response: ' + response);
        return response;
    } 
    
    // custom backend (REST/gRPC)
    else {
        let request = { 
            method: "POST", 
            body: JSON.stringify({
                payment_hash: payment_hash_in
            }),
            headers: {
                "Content-Type": "application/json"
            }
        };
        let response = await fetch('/lookupinvoice', request);
        let data = JSON.parse(await response.json());
        console.log('lookupinvoice response: ' + data);
        return data;
    }
}

async function sendpayment(server_pubkey, payment_hash, server_payment_request) {
    
    // webLN
    if (webln_connection == true) {
        let response = webln.sendPayment(server_payment_request);
        console.log('sendpayment response: ' + response);
        return response;
    } 
    
    // custom backend (REST/gRPC)
    else {
        let request = {
            method: "POST",
            body: JSON.stringify({
                dest: server_pubkey, 
                payment_hash: payment_hash,
                payment_request: server_payment_request
            }),
            headers: {
                "Content-Type": "application/json"
            }
        };
        let response = await fetch('/sendpayment', request);
        let data = JSON.parse(await response.json());
        console.log('sendpayment response: ' + data);
        return data;
    }
}

/////////////////////////////
// LOMOL server calls
/////////////////////////////

async function getpaymenthash() {
    const response = await fetch('/getpaymenthash', { method: "GET" });
    const data = JSON.parse(await response.json());
    return data;
}

async function getserverpubkey() {
    const response = await fetch('/getserverpubkey', { method: "GET" });
    const data = JSON.parse(await response.json());
    return data;
}

async function negotiateorder(request) {
    const response = await fetch('/negotiateorder', request);
    const data = JSON.parse(await response.json());
    return data;
}

async function placeorder(request) {
    const response = await fetch('/placeorder', request);
    const data = await response.json();
    return data;
}

async function settickerprice() {
    const response = await fetch('/gettickerprice', { method: "GET" });
    const data = await response.json();
    ticker_price = document.getElementById("price-ticker");
    ticker_price.innerHTML = data;
}

async function fillorderbooktables() {
    let response = await fetch('/getorderbooks', { method: "GET" });
    let orderbooks = JSON.parse(await response.json());    
    
    let buy_table = document.getElementById("buy-order-book")
    let old_buy_table_body = document.getElementById("buy-order-book-body")
    let new_buy_table_body = document.createElement('tbody');
    let buy_table_data_array = orderbooks.buy_order_book.data;
    buy_table_data_array.slice().reverse().forEach( item => {
        let row = new_buy_table_body.insertRow();
        let amount = row.insertCell(0);
        amount.innerHTML = item.quantity;
        let price = row.insertCell(1);
        price.innerHTML = item.price;
    });
    buy_table.replaceChild(new_buy_table_body, buy_table.childNodes[0])

    let sell_table = document.getElementById("sell-order-book")
    let old_sell_table_body = document.getElementById("sell-order-book-body")
    let new_sell_table_body = document.createElement('tbody');
    let sell_table_data_array = orderbooks.sell_order_book.data;
    sell_table_data_array.slice().reverse().forEach( item => {
        let row = new_sell_table_body.insertRow();
        let amount = row.insertCell(0);
        amount.innerHTML = item.quantity;
        let price = row.insertCell(1);
        price.innerHTML = item.price;
    });
    sell_table.replaceChild(new_sell_table_body, sell_table.childNodes[0])
}

/////////////////////////////
// Client functions
/////////////////////////////

// post order function
async function postorder(order_type) { 

    let price = document.getElementById('price').value;
    let amount = document.getElementById('amount').value;
    console.log('order amount: ' + amount);
    console.log('order price: ' + price);

    let iterations =  amount / 1000;
    for(var i = 0; i < iterations; i++){
        
        // order negotiation steps (payment hash is the same for both client and server)
        let payment_hash = await getpaymenthash(); 
        let client_payment_request = await addholdinvoice(payment_hash, 1000);
        let order_request = await createaddorderrequest(payment_hash, client_payment_request, client_pubkey, order_type, price);
        console.log('order_request: ' + JSON.stringify(order_request));
        let server_payment_request = await negotiateorder(order_request);
        
        console.log('payment_hash: ' + payment_hash);
        console.log('server_payment_request: ' + server_payment_request);
                
        //check if server paid client payment request before placing order (i.e. paying server payment request)
        for (let i = 0; i < 20; i++) {
            let invoice_tocheck = await lookupinvoice(payment_hash);
            if (invoice_tocheck.state == 'ACCEPTED') {
                
                // trigger send payment to server, no need to wait for response since it is a hold invoice
                sendpayment(server_pubkey, payment_hash, server_payment_request);
                console.log('Server payment has been received and own payment with has been sent. Now placing order...');
                
                // order placement
                let response = await placeorder(order_request);
                console.log(response);
                break;

            } else {
                console.log('Server payment has not been received yet. Waiting and trying again...')
                await sleep(50);
            }
        }
    }
}

/////////////////////////////
// Event listeners 
/////////////////////////////

let [client_pubkey, server_pubkey] = [null, null];
let webln_connection = false;

let input = document.getElementById('toggleswitch');
let webln_text = document.getElementById('status');

input.addEventListener('change', async function(){
    if(this.checked) {
        webln_text.innerHTML = "webLN";
        webln_connection = true;
        await webln.enable();
        client_pubkey = await getclientpubkey();
    } else {
        webln_text.innerHTML = "Custom Backend";
        webln_connection = false;
    }
});

window.addEventListener('DOMContentLoaded', async (event) => {
    window.setTimeout(async function () { 
        // get client and server pubkeys
        client_pubkey = await getclientpubkey();
        server_pubkey = await getserverpubkey();
        console.log('client_pubkey: ' + client_pubkey);
        console.log('server_pubkey: ' + server_pubkey);
    }, 300);
});

document.getElementById('buy-button').addEventListener('click', async (event) => {
    event.preventDefault();
    
    const start = Date.now();
    await postorder('BUY');
    const end = Date.now();
    
    console.log(`Execution time: ${end - start} ms`);
});

document.getElementById('sell-button').addEventListener('click', async (event) => {
    event.preventDefault();
    
    const start = Date.now();
    await postorder('SEL');
    const end = Date.now();
    
    console.log(`Execution time: ${end - start} ms`);
});

document.getElementById('test-button').addEventListener('click', async (event) => {
    event.preventDefault();
    await getclientpubkey();
});

window.setInterval(async ()=>{ await fillorderbooktables() }, 500);

window.setInterval(async ()=>{ await settickerprice() }, 500);

/////////////////////////////
// Helper functions
/////////////////////////////

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createaddorderrequest(payment_hash, client_payment_request, client_pubkey, order_type, price) {
    let order_request = {
        method: "POST",
        body: JSON.stringify({
            payment_hash: payment_hash,
            payment_request: client_payment_request,
            raw_order: {
                user_id: client_pubkey, 
                order_id: payment_hash,
                order_type: order_type,
                order_action: 'ADD',
                quantity: 1000,
                price: parseInt(price),
            }
        }),
        headers: {
            "Content-Type": "application/json"
        }
    };
    return order_request;
}