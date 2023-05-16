/////////////////////////////
// Client LND node calls
/////////////////////////////

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getclientpubkey() {
    let response = await fetch('/getinfo', { method: "POST" });
    let data = await JSON.parse(await response.json());
    return data.identity_pubkey;
}

async function addholdinvoice(hash, value) {
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
    return data.payment_request;
}

async function lookupinvoice(payment_hash_in) {
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
    return data;
}

async function sendpayment(server_pubkey, payment_hash, server_payment_request) {
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
    return data;
}

/////////////////////////////
// LOMOL server calls
/////////////////////////////

async function getorderbooks() {
    const response = await fetch('/getorderbooks', { method: "GET" });
    const data = JSON.parse(await response.json());
    return data;
}

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


/////////////////////////////
// Client functions
/////////////////////////////

async function createaddorderrequest(payment_hash, payment_request, client_pubkey, order_type, price) {
    let order_request = {
        method: "POST",
        body: JSON.stringify({
            payment_hash: payment_hash,
            payment_request: payment_request,
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

async function postorder(order_type) { 

    let price = document.getElementById('price').value;
    let amount = document.getElementById('amount').value;
    console.log('order amount: ' + amount);
    console.log('order price: ' + price);

    let iterations =  amount / 1000;
    for(var i = 0; i < iterations; i++){

        // payment hash is the same for both client and server
        let payment_hash = await getpaymenthash(); 
        console.log('payment_hash: ' + payment_hash);

        let payment_request = await addholdinvoice(payment_hash, 1000);
        let client_pubkey = await getclientpubkey();
        
        let order_request = await createaddorderrequest(payment_hash, payment_request, client_pubkey, order_type, price);
        
        let server_payment_request = await negotiateorder(order_request);
        console.log('server_payment_request: ' + server_payment_request);
        
        let server_pubkey = await getserverpubkey();
        console.log('server destination pubkey: ' + server_pubkey);
        
        //check if server paid client payment request
        for (let i = 0; i < 10; i++) {
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
                await sleep(10);
            }
        }
    }
}

// async function postsellorder() {
//     const order_type = 'SEL'
//     const iterations =  (document.getElementById('amount').value) / 1000;
//     console.log(iterations)
//     for(var i = 0; i < iterations; i++) {
//         const price = document.getElementById('price').value;
//         console.log(price);
//         const payment_hash = await getpaymenthash(); 
//         console.log(payment_hash);
//         const payment_request = await addholdinvoice(payment_hash, 1000);
//         console.log(payment_request);
//         const client_pubkey = await getclientpubkey();
//         console.log(client_pubkey);
//         const request = {
//             method: "POST",
//             body: JSON.stringify({
//                 payment_hash: payment_hash,
//                 payment_request: payment_request,
//                 raw_order: {
//                     user_id: client_pubkey, 
//                     order_id: payment_hash,
//                     order_type: order_type,
//                     order_action: 'ADD',
//                     quantity: 1000,
//                     price: parseInt(price),
//                 }
//             }),
//             headers: {
//                 "Content-Type": "application/json"
//             }
//         };
//         const response = await fetch('/negotiateorder', request);
//         const server_payment_request = await JSON.parse(await response.json());
//         console.log(server_payment_request);
//         const server_pubkey = await getserverpubkey();
//         console.log('server destination pubkey: ' + server_pubkey);
//         //check if server paid client payment request
//         for (let i = 0; i < 10; i++) {
//             var invoice_tocheck = await lookupinvoice(payment_hash);
//             if (invoice_tocheck.state == 'ACCEPTED') {
//                 // send payment to server
//                 console.log('server_pubkey: ' + server_pubkey);
//                 console.log('payment_hash: ' + payment_hash);
//                 console.log('server_payment_request: ' + server_payment_request);
//                 sendpayment(server_pubkey, payment_hash, server_payment_request);
//                 console.log('Server payment has been received and own payment has been sent. Now placing order...');
//                 // trigger order placement
//                 var response2 = await fetch('/placeorder', request);
//                 response2 = await response2.json();
//                 console.log(response2);
//                 break;
//             } else {
//                 console.log('Server payment has not been received yet. Waiting and trying again...')
//                 await sleep(10);
//             }
//         }
//     }
// }

