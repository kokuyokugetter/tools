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

// 元号何年計算(平成、令和のみ)
jQuery( function() {
    inputnow();
    CalJapaneseEra();
    var $formObjectInputInch = jQuery( '#yearForm :input[name=year]' );
    $formObjectInputInch.change( function() { CalJapaneseEra(); } );
    $formObjectInputInch.keyup( function() { CalJapaneseEra(); } );
} );
function inputnow() {
    var now = new Date();
    var year = now.getFullYear();
    jQuery( '#yearForm :input[name=year]' ).val( year );
}
function CalJapaneseEra() {
    var $formObject = jQuery( '#yearForm' );
    var year = $formObject.find( '[name=year]' ).val()
    var diff_heisei = year - 1988
    var diff_reiwa = year - 2018
    if (diff_heisei < 1) {
        jQuery( '#era' ).html( "1989〜2050年のみ対応" );
        jQuery( '#yearValue' ).html( "" );
        return 0;
      }
    if (year == 2019) {
        jQuery( '#era' ).html( "令和1年" );
        jQuery( '#yearValue' ).html( "平成31年" );
        return 0;
    }
    if (diff_reiwa > 0) {
        jQuery( '#era' ).html( "令和" );
        jQuery( '#yearValue' ).html( `${diff_reiwa}年` );
        return 0;
    }
    jQuery( '#era' ).html( "平成" );
    jQuery( '#yearValue' ).html( `${diff_heisei}年` );
}