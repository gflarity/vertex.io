/* Author: 

*/




$(function() {
    var headerHeight = $("header").outerHeight(true),
    magicHeight = $("#headline").offset().top + $("#headline").outerHeight(true);
    function scrollHeader() {
        var scrollTop = $('html').get(0).scrollTop;
        if (scrollTop == 0) scrollTop = $('body').get(0).scrollTop;
        if (scrollTop < headerHeight) {
            if ($('body').hasClass("fixedh")) {
                $("body").removeClass("fixedh");
                $("header").stop().css("opacity", "1").css("top", "0");
            }
        } else if (scrollTop >= magicHeight) {
            if (!$('body').hasClass("fixedh")) {
                $("body").addClass("fixedh");
                $("header").css("opacity", "0").css("top", "-84px").stop().animate({
                    opacity: 1,
                    top: 0
                },
                250);
            }
        } else if (scrollTop < magicHeight && $('body').hasClass("fixedh")) {
            $("header").stop().animate({
                opacity: 1,
                top: -84
            },
            250,
            function() {
                $("body").removeClass("fixedh");
                $("header").css("opacity", "1").css("top", "0");
            });
        }
    }
    $(window).scroll(function() {
        scrollHeader();
    });
    scrollHeader();

    // scroll links
    $("a[href^='#']").click(function() {
        if ($(this).attr("id") == "fdbk_tab" || $(this).attr("id") == "fdbk_close") return true;
        
        var scrollTop = 0,
        focusEmail = false;
        if ($(this).attr("href") == "#signup") {
            focusEmail = true;
        } else if ($(this).attr("href").length > 1) {
            scrollTop = $("[name='" + $(this).attr("href").substring(1) + "']").offset().top;
        }
        $('body, html').animate({
            scrollTop: scrollTop
        },
        200,
        function() {
            if (focusEmail) $("#email").focus();
        });
        return false;
    });

    var _startpt=(new Date()).getTime();
    $("#signup_form").submit(function() {
        var _nowpt = (new Date()).getTime();
        var _diffpt = _nowpt - _startpt;
        if (_diffpt < 2000) return false;
        
        var email = $('input[name=email]');
        var confuca = $('input[name=confuca]');
        
        //Organize data
        var data = {
            email: email.val(),
            confuca: confuca.val()
        };
        
        //Simple Validation
        if (data.email.length < 6) {
          $("#signup .message").hide();
          $('#signup_form input').removeAttr('disabled');
          $("#signup .error").html("Please enter a <span>valid</span> email.");
          $("#signup .error").fadeIn('slow');
          email.addClass("highlight");
          email.focus();
          return false;
        }

        //Disable fields
        $('#signup_form input').attr('disabled', 'true');

        //Show loading sign
        $('#signup .loading').show();

        //Start the Ajax
        $.ajax({
            type: 'POST',
            url: '/invitation/request',
            data: data,
            cache: false,
            success: function(data) {
                $("#signup .message").hide();
                $('#signup_form input').removeAttr('disabled');
                if (data) {
                    if (data.success) {
                        $("#signup form").hide();
                        $("#signup .error").hide();
                        email.removeClass("highlight");
                        if (data.repeat) {
                          $("#signup .success.repeat").fadeIn('slow');
                        } else {
                          $("#signup .success.new").fadeIn('slow');
                        }
                    } else {
                        $("#signup .error").html(data.errors.join(','));
                        $("#signup .error").fadeIn('slow');
                        email.addClass("highlight");
                        email.focus();
                    }
                } else {
                    alert('Sorry, unexpected error. Please try again later.');
                }
            },
            dataType: 'json'
        });

        return false;
    });
});












