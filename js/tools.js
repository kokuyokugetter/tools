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

// 干支
jQuery( function() {
    decideZodiac();
    var $formObjectInputInch = jQuery( '#yearForm :input[name=year]' );
    $formObjectInputInch.change( function() { decideZodiac(); } );
    $formObjectInputInch.keyup( function() { decideZodiac(); } );
} );
function decideZodiac() {
    var $formObject = jQuery( '#yearForm' );
    var year = $formObject.find( '[name=year]' ).val()
    let zodiac = ['サル', 'トリ', 'イヌ', 'イノシシ', 'ネズミ', 'ウシ',
        'トラ', 'ウサギ', 'リュウ', 'ヘビ', 'ウマ', 'ヒツジ'] //サルが12で割り切れる年なので0番目
    jQuery( '#zodiacName' ).html( zodiac[(year) % 12] );
}

//閏年
jQuery( function() {
    decideLeapYear();
    var $formObjectInputInch = jQuery( '#yearForm :input[name=year]' );
    $formObjectInputInch.change( function() { decideLeapYear(); } );
    $formObjectInputInch.keyup( function() { decideLeapYear(); } );
} );
function decideLeapYear() {
    var $formObject = jQuery( '#yearForm' );
    var year = $formObject.find( '[name=year]' ).val()
    if (year % 400 == 0) {
        jQuery( '#isLeapYear' ).html( "閏年" );
        return 0;
    }
    if (year % 100 == 0) {
        jQuery( '#isLeapYear' ).html( "" );
        return 0;
    }
    if (year % 4 == 0) {
        jQuery( '#isLeapYear' ).html( "閏年" );
        return 0;
    }
    jQuery( '#isLeapYear' ).html( "" );
}

// 年齢計算
jQuery( function() {
    calAge();
    var $formObjectInputInch = jQuery( '#yearForm :input[name=year]' );
    $formObjectInputInch.change( function() { calAge(); } );
    $formObjectInputInch.keyup( function() { calAge(); } );
    var $formObjectInputInch = jQuery( '#birthYearForm :input[name=birth]' );
    $formObjectInputInch.change( function() { calAge(); } );
    $formObjectInputInch.keyup( function() { calAge(); } );
} );
function calAge() {
    var $formObject = jQuery( '#yearForm' );
    var year = $formObject.find( '[name=year]' ).val()
    var $formObject2 = jQuery( '#birthYearForm' );
    var birth = $formObject2.find( '[name=birth]' ).val()
    jQuery( '#ageValue' ).html( year - birth );
}