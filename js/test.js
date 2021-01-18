jQuery( function() {
    getValue();
    var $formObjectInputs = jQuery( '#bmiForm :input' );
    $formObjectInputs.change( function() { getValue(); } );
    $formObjectInputs.keyup( function() { getValue(); } );
} );
function getValue() {
    var $formObject = jQuery( '#bmiForm' );
    var height_m = ($formObject.find( '[name=formHeight]' ).val()) / 100
    var bmi = $formObject.find( '[name=formWeight]' ).val() / height_m / height_m
    jQuery( '#bmiValue' ).html( bmi );
}