var dbSize = 5 * 1024 * 1024;
var db;

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
                    console.log(contacts[i].phoneNumbers);
                    insertPhonebookRow(contacts[i].displayName, contacts[i].phoneNumbers[0].value);
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
                    list.append(`<li><a class="" data-id="${results.rows.item(i).ID}">${results.rows.item(i).strFullName}</li>`);
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
                    let contactName = field1;
                    let contactEmail = field2;
                    tx.executeSql(`INSERT INTO contacts(strFullName, strEmail) VALUES (?,?)`, [contactName, contactEmail], (tx, res)=>{
                        console.log(res);
                        resolve(res);
                    });  
                });
            });
            
        }

        async function insertPhonebookRow(field1, field2){
            return new Promise(function(resolve, reject){
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
    
                db.transaction(function(tx) {
                    tx.executeSql("CREATE TABLE IF NOT EXISTS " +
                            "phonebook(ID INTEGER PRIMARY KEY ASC, strFullName, strPhone)");
                });
    
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
                        let record = await fetchRowFromContacts(event.target.event.target.getAttribute('data-id'));
                        $("#editContactId").val(record.ID);
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

        async function updateContactsRow(data){
            return new Promise((resolve, reject) =>{
                db = openDatabase("contactapp", "1", "Contact App", dbSize);
                db.transaction( (tx) =>{
                    tx.executeSql('UPDATE contacts SET strFullName=?, strEmail= ? WHERE id=?', [data.strFullName, data.strEmail, data.id], (tx, res) =>{
                        resolve(res);
                    });
                });
            });
        }

        $(document).ready(function(){     
            $("#saveNewContact").bind( "tap", tapHandler );
            $("#saveEditContact").bind( "tap", saveEditHandler );

            openDBandLoadContacts();

            async function tapHandler( event ){
                await insertRow($("#contactName").val(), $("#contactEmail").val());
                $("body").pagecontainer("change", "#home");
            }

            async function saveEditHandler (event){
                let result = await updateContactsRow({
                    'id': $('#editContactId').val(), 
                    'strFullName': $('#editContactName').val(), 
                    'strEmail': $('#editContactEmail').val()
                });
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
                    });
                });
            });
            
       
        });
    }
};
