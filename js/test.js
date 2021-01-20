// BMI
jQuery( function() {
    setBmi();
    var $formObjectInputs = jQuery( '#bmiForm :input' );
    $formObjectInputs.change( function() { setBmi(); } );
    $formObjectInputs.keyup( function() { setBmi(); } );
} );
function setBmi() {
    var $formObject = jQuery( '#bmiForm' );
    var height_m = ($formObject.find( '[name=formHeight]' ).val()) / 100
    var bmi = $formObject.find( '[name=formWeight]' ).val() / height_m / height_m
    jQuery( '#bmiValue' ).html( bmi );
}

// センチインチ変換
jQuery( function() {
    convertCenti();
    var $formObjectInputInch = jQuery( '#inch-centiForm :input[name=formInch]' );
    $formObjectInputInch.change( function() { convertCenti(); } );
    $formObjectInputInch.keyup( function() { convertCenti(); } );
    var $formObjectInputCenti = jQuery( '#inch-centiForm :input[name=formCenti]' );
    $formObjectInputCenti.change( function() { convertInch(); } );
    $formObjectInputCenti.keyup( function() { convertInch(); } );
} );
function convertCenti() {
    var $formObject = jQuery( '#inch-centiForm' );
    var centi = ($formObject.find( '[name=formInch]' ).val()) * 2.54
    jQuery( '#inch-centiForm :input[name=formCenti]' ).val( centi );
}
function convertInch() {
    var $formObject = jQuery( '#inch-centiForm' );
    var inch = ($formObject.find( '[name=formCenti]' ).val()) / 2.54
    jQuery( '#inch-centiForm :input[name=formInch]' ).val( inch );
}
