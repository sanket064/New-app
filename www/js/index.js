var myGamePiece;

function startGame() {
    myGameArea.start();
    myGamePiece = new component(30, 30, "red", 10, 120);
}

var myGameArea = {
    canvas : document.createElement("canvas"),
    start : function() {
        this.canvas.width = 480;
        this.canvas.height = 270;
        this.context = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);
    }
}

function component(width, height, color, x, y) {
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;    
    ctx = myGameArea.context;
    ctx.fillStyle = color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
}

var dbSize = 5 * 1024 * 1024;
var db;
var baseUrl = "http://vanapi.gitsql.net";

var app = {

    initialize: function() {
        this.bindEvents();
    },
    
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
    },
    
    receivedEvent: function(readyText) {
        db = openDatabase("contactapp", "1", "Contact App", dbSize);
        db.transaction(function(tx){
            tx.executeSql("CREATE TABLE IF NOT EXISTS " +
                    "contacts(ID INTEGER PRIMARY KEY ASC, strFullName, strEmail, strPhone, strPicture, lat, long, serverId)");
        });
        
        db.transaction(function(tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS " +
                    "phonebook(ID INTEGER PRIMARY KEY ASC, strFullName, strPhone)");
        });
        
        function onGeoSuccess(position) {
            let coords = { 'lat': position.coords.latitude, 'long': position.coords.longitude };
            localStorage.setItem('currentPosition', JSON.stringify(coords));
            console.log(coords);
            
            var myLatLng = {lat: coords.lat, lng: coords.long};
            var map = new google.maps.Map(document.getElementById('map'), {
              zoom: 20,
              center: myLatLng
            });
    
            var marker = new google.maps.Marker({
              position: myLatLng,
              map: map,
              title: 'My Location'
            });
        }
        function onGeoError(error) {
            alert('code: '    + error.code    + '\n' +
                'message: ' + error.message + '\n');
        }
        // Options: throw an error if no update is received every 30 seconds.
        geoOpts = { maximumAge: 3000, timeout: 5000, enableHighAccuracy: true};
        // var watchID = navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, geoOpts);
        var options = new ContactFindOptions();
        options.filter="";          // empty search string returns all contacts
        options.multiple=true;      // return multiple results
        filter = ["displayName"];   // return contact.displayName field
        // find contacts
        navigator.contacts.find(filter, onSuccess, onError, options);
        // onSuccess: Get a snapshot of the current contacts
        //
        function onSuccess(contacts) {
            for (var i=0; i<contacts.length; i++) {
                if (contacts[i].phoneNumbers) {  // many contacts don't have displayName
                    let name = contacts[i].displayName;
                    try {
                        name = contacts[i].name.givenName;
                    }
                    catch{
                        console.log('Unable to find givenName')
                    }
                    insertPhonebookRow(name, contacts[i].phoneNumbers[0].value); 
                    if (i == 20) break;
                }
            }
            alert('contacts loaded');
        }
        
        function onError(err){
            console.log(err);
        }
        async function displayContacts(tx, results){
            return new Promise((resolve, reject) => {
                var list = $("#contactListLi");
                list.empty();
                console.log(results.rows);
                var len = results.rows.length, i;
                for (i = 0; i < len; i++) {
                    list.append(`<li><a class="editContact" data-id="${results.rows.item(i).ID}">${results.rows.item(i).strFullName}</li>`);
                }
                $("#contactListLi").listview("refresh");
                resolve();
            });
        }
        async function displayPhoneContacts(tx, results){
            return new Promise((resolve, reject) => {
                var list = $("#phoneContactsListLi");
                list.empty();
                console.log(results.rows);
                var len = results.rows.length, i;
                for (i = 0; i < len; i++) {
                    list.append(`<li><a class="copyPhoneContact" data-id="${results.rows.item(i).ID}">${results.rows.item(i).strFullName}</li>`);
                }
                $("#phoneContactsListLi").listview("refresh");
                resolve();
            });
        }
        async function insertRow(field1, field2){
            return new Promise(function(resolve, reject){
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
    
                db.transaction(function(tx) {
                    tx.executeSql("CREATE TABLE IF NOT EXISTS " +
                            "contacts(ID INTEGER PRIMARY KEY ASC, strFullName, strEmail, strPhone, strPicture)");
                });
    
                // save our form to websql
                db.transaction(function(tx){
                    tx.executeSql(`INSERT INTO contacts(strFullName, strEmail) VALUES (?,?)`, [field1, field2], (tx, res)=>{
                        console.log(res);
                        resolve(res);
                    });  
                });
            });
            
        }
        
        async function insertPhonebookRow(field1, field2){
            return new Promise(function(resolve, reject){
                
    
                // save our form to websql
                db.transaction(function(tx){
                    tx.executeSql(`INSERT INTO phonebook(strFullName, strPhone) VALUES (?,?)`, [field1, field2], (tx, res)=>{
                        console.log(res);
                        resolve(res);
                    });  
                });
            });
            
        }
        function openDBandLoadContacts(){
            db = openDatabase("contactapp", "1", "Contact App", dbSize);
            db.transaction(function(tx){
                tx.executeSql("SELECT * FROM contacts",[], async (tx, results)=>{
                    await displayContacts(null, results);
                    $(".editContact").bind( "tap", async (event) =>{
                        let record = await fetchRowFromContacts(event.target.getAttribute('data-id'));
                        $("#editContactId").val(record.ID);
                        $("#editContactServerId").val(record.serverId);
                        $("#editContactName").val(record.strFullName);
                        $("#editContactEmail").val(record.strEmail);
                        $("body").pagecontainer("change", "#editContactPage");
                    });
                });
            });
        }
        async function fetchRowFromContacts(id){
            return new Promise((resolve, reject)=>{
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
                db.transaction(function(tx){
                    tx.executeSql(`SELECT * FROM contacts where ID = ?`,[id], (tx, results)=>{
                        resolve(results.rows.item(0));
                    });
                });
            });
        }
        async function deleteContactFromDBandCloud(id, serverId){
            return new Promise((resolve, reject)=>{
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
                db.transaction(function(tx){
                    tx.executeSql(`delete FROM contacts where ID = ?`,[id], (tx, results)=>{
                        $.ajax({
                            type: "DELETE",
                            url: `${baseUrl}/contacts/${serverId}`,
                            contentType: "application/json; charset=utf-8",
                            beforeSend: function(xhr){xhr.setRequestHeader('authtoken', localStorage.getItem('token'))},
                            success: function(response) {
                                console.log(response);
                                resolve();
                            },
                            error: function(e) {
                                alert('Error: ' + e.message);
                            }
                        });
                    });
                });
            });
        }
        async function checkDupeServerId(serverId){
            return new Promise((resolve, reject)=>{
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
                db.transaction(function(tx){
                    tx.executeSql(`SELECT * FROM contacts where serverId = ?`,[serverId], (tx, results)=>{
                        if(results.rows.length>0){
                            resolve(true);
                        }else{
                            resolve(false);
                        }
                    });
                });
            });
        }
        async function fetchRowFromPhoneContacts(id){
            return new Promise((resolve, reject)=>{
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
                db.transaction(function(tx){
                    tx.executeSql(`SELECT * FROM phonebook where ID = ?`,[id], (tx, results)=>{
                        resolve(results.rows.item(0));
                    });
                });
            });
        }
        async function updateContactsRow(data, serverId=''){
            return new Promise((resolve, reject) =>{
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
                db.transaction( (tx) =>{
                    tx.executeSql('UPDATE contacts SET strFullName=?, strEmail= ? WHERE id=?', [data.strFullName, data.strEmail, data.id], (tx, res) =>{
                        if(serverId !== ''){
                            $.ajax({
                                type: "PUT",
                                url: `${baseUrl}/contacts/${serverId}`,
                                contentType: "application/json; charset=utf-8",
                                dataType: "json",
                                data:  JSON.stringify({
                                    id: serverId,
                                    firstName: data.strFullName,
                                    lastName: '',
                                    contactNumber: data.strEmail
                                }),
                                beforeSend: function(xhr){xhr.setRequestHeader('authtoken', localStorage.getItem('token'))},
                                success: function(response) {
                                    resolve(res);
                                },
                                error: function(e) {
                                    alert('Error: ' + e.message);
                                }
                            });
                        } else{
                            resolve(res);
                        }
                    });
                });
            });
        }
        $(document).ready(function(){     
            $("#saveNewContact").bind( "tap", tapHandler );
            $("#saveEditContact").bind( "tap", saveEditHandler );
            $("#loginButton").bind( "tap", performLogin);
            $("#deleteContact").bind( "tap", deleteContact);
            function initialSync(){
                $.ajax({
                    type: "GET",
                    url: `${baseUrl}/contacts`,
                    contentType: "application/json; charset=utf-8",
                    dataType: "json",
                    beforeSend: function(xhr){xhr.setRequestHeader('authtoken', localStorage.getItem('token'))},
                    success: function(response) {
                        console.log(response);
                        asyncForEach(response, async (record) => {
                            await insertRow(record.firstName, record.contactNumber, record.id, true);
                        });
                        
                        openDBandLoadContacts();
                    },
                    error: function(e) {
                        alert('Error: ' + e.message);
                    }
                }); 
            }
            function performLogin(){
                data = {
                    "username": $("#username").val(),
                    "password": $("#password").val()
                }
                $.ajax({
                    type: "POST",
                    url: `${baseUrl}/auth`,
                    data: JSON.stringify(data),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json",
                    success: function(response) {
                        console.log(response);
                        localStorage.setItem('token', response.token);
                        $("body").pagecontainer("change", "#home");
                    },
                    error: function(e) {
                        alert('Error: ' + e.message);
                    }
                });
            }
            openDBandLoadContacts();
            async function tapHandler( event ){
                await insertRow($("#contactName").val(), $("#contactEmail").val());
                $("body").pagecontainer("change", "#home");
            }
            async function saveEditHandler (event){
                let result = await updateContactsRow({
                    'id': $('#editContactId').val(), 
                    'strFullName': $('#editContactName').val(), 
                    'strEmail': $('#editContactEmail').val(),
                }, $('#editContactServerId').val());
                $("body").pagecontainer("change", "#home");
            }
            
            async function deleteContact (event){
                // delete contact from webSQl db
                // send delete ajax to remove it from the server too
                await deleteContactFromDBandCloud($('#editContactId').val(), $('#editContactServerId').val());
                $("body").pagecontainer("change", "#home");
            }
            $(document).on( 'pagebeforeshow' , '#home' ,function(event){
                openDBandLoadContacts();
            }); 
            $(document).on( 'pagebeforeshow' , '#phonebook' ,function(event){
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
                db.transaction(function(tx){
                    tx.executeSql("SELECT * FROM phonebook",[], async (tx, results)=>{
                        await displayPhoneContacts(null, results);
                        debugger;
                        $(".copyPhoneContact").bind( "tap", async (event) =>{
                            let record = await fetchRowFromPhoneContacts(event.target.getAttribute('data-id'));
                            await insertRow(record.strFullName, record.strPhone);
                            $("body").pagecontainer("change", "#home");
                        });
                    });
                });
            });
        });
    }
};

   