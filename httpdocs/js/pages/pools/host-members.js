/**
 * (C) ntop.org - 2020
 * This script manage the GUI for Host Pool Members page
 */

$(document).ready(function () {

    let memberRowData = null;

    // this is the current filtering type for the datatable
    let currentType = null;

    const filters = [
        {
            regex: NtopUtils.getIPv4RegexWithCIDR(),
            label: i18n.ipv4,
            key: 'ipv4_filter',
            countable: true,
            callback: () => { currentType = "ip"; $hostMembersTable.rows().invalidate(); }
        },
        {
            regex: NtopUtils.getIPv6RegexWithCIDR(),
            label: i18n.ipv6,
            key: 'ipv6_filter',
            countable: true,
            callback: () => { currentType = "ip"; $hostMembersTable.rows().invalidate(); }
        },
        {
            regex: NtopUtils.REGEXES.macAddress,
            label: i18n.mac_filter,
            key: 'mac_filter',
            countable: true,
            callback: () => { currentType = "mac"; $hostMembersTable.rows().invalidate(); }
        },
    ];

    let dtConfig = DataTableUtils.getStdDatatableConfig([
        {
            text: '<i class="fas fa-plus"></i>',
            action: () => { $(`#add-member-modal`).modal('show'); }
        }
    ]);
    dtConfig = DataTableUtils.setAjaxConfig(dtConfig, `${http_prefix}/lua/rest/v1/get/host/pool/members.lua?pool=${queryPoolId}`, `rsp`);
    dtConfig = DataTableUtils.extendConfig(dtConfig, {
        stateSave: true,
        hasFilters: true,
        columns: [
            {
                data: 'name',
                render: function (data, type, row) {

                    if (type == "sort" || type == "type") {
                        if (currentType == "mac") return $.fn.dataTableExt.oSort["mac-address-pre"](data);
                        return $.fn.dataTableExt.oSort["ip-address-pre"](data);
                    }

                    return data;
                }
            },
            {
                data: 'vlan',
                width: '5',
                className: 'text-center',
                render: function (data, type, row) {

                    if (data == 0 && type == "display") return "";
                    return data;
                }
            },
            {
                data: null, targets: -1, className: 'text-center',
                width: "10%",
                render: function () {

                    return DataTableUtils.createActionButtons([
                        { class: 'btn-danger', icon: 'fa-trash', modal: '#remove-member-host-pool'}
                    ]);
                }
            }
        ],
        initComplete: function (settings, json) {

            const tableAPI = settings.oInstance.api();
            DataTableUtils.addFilterDropdown(
                i18n.member_type, filters, 0, '#host-members-table_filter', tableAPI
            );
        }
    });

    const $hostMembersTable = $(`#host-members-table`).DataTable(dtConfig);

    $(`#host-members-table`).on('click', `a[href='#remove-member-host-pool']`, function (e) {
        memberRowData = $hostMembersTable.row($(this).parent().parent()).data();
        $removeModalHandler.invokeModalInit();
    });

    $(`#select-host-pool`).change(function () {
        // update selected pool information
        selectedPool = { name: $(`#select-host-pool option:selected`).text(), id: $(this).val() };
        // update the datatable
        $hostMembersTable.ajax.url(`${http_prefix}/lua/rest/v1/get/host/pool/members.lua?pool=${selectedPool.id}`).load().draw(false);
        queryPoolId = selectedPool.id;
        history.pushState({ pool: queryPoolId }, '', location.href.replace(/pool\=[0-9]+/, `pool=${queryPoolId}`));
    });

    $(window).on('popstate', function (e) {
        const { state } = e.originalEvent;
        $(`#select-host-pool`).val(state.pool).trigger('change');
    });

    $(`#add-member-modal form`).modalHandler({
        method: 'post',
        csrf: addCsrf,
        resetAfterSubmit: false,
        endpoint: `${http_prefix}/lua/rest/v1/bind/host/pool/member.lua`,
        onModalShow: function () {
            // hide the fields and select default type entry
            const macAndNetworkFields = "#add-member-modal .mac-fields, #add-member-modal .network-fields";
            $(macAndNetworkFields).hide();

            $(`#add-member-modal .ip-fields`).show().find(`input,select`).removeAttr("disabled");

            $(`#add-modal-feedback`).hide();
        },
        onModalInit: function () {
            // on select member type shows only the fields interested
            $(`#add-member-modal select[name='member_type']`).change(function () {

                const value = $(this).val();
                // clean the members and show the selected one
                $(`#add-member-modal [class*='fields']`).hide()
                    .find('input,select').attr("disabled", true).removeClass('is-invalid');
                $(`#add-member-modal [class*='fields'] input`).val("");
                // select the default value inside the selected
                $(`#add-member-modal [class*='fields'] select`).val($(`#add-member-modal [class*='fields'] select option[selected]`).val());
                $(`#add-member-modal [class*='fields'] select option`).removeAttr("disabled");

                $(`#add-member-modal [class='${value}-fields']`).fadeIn().find('input,select').removeAttr("disabled");
            });
        },
        beforeSumbit: function () {

            let member;
            const typeSelected = $(`#add-member-modal select[name='member_type']`).val();

            if (typeSelected == "mac") {
                member = $(`#add-member-modal input[name='mac_address']`).val();
            }
            else if (typeSelected == "ip") {

                const ipAddress = $(`#add-member-modal input[name='ip_address']`).val();
                const vlan = $(`#add-member-modal input[name='ip_vlan']`).val() || 0;
                const cidr = NtopUtils.is_good_ipv6(ipAddress) ? 128 : 32;
                member = `${ipAddress}/${cidr}@${vlan}`;
            }
            else {

                const network = $(`#add-member-modal input[name='network']`).val();
                const cidr = $(`#add-member-modal input[name='cidr']`).val();
                const vlan = $(`#add-member-modal input[name='network_vlan']`).val() || 0;

                member = `${network}/${cidr}@${vlan}`;
            }

            return { pool: selectedPool.id, member: member };
        },
        onSubmitSuccess: function (response, textStatus, modalHandler) {

            if (response.rc < 0) {
                $(`#add-modal-feedback`).html(i18n.rest[response.rc_str]).fadeIn();
                return;
            }

            $hostMembersTable.ajax.reload();

            modalHandler.cleanForm();
            $(`#add-member-modal`).modal('hide');
        }
    }).invokeModalInit();

    const $removeModalHandler = $(`#remove-member-host-pool form`).modalHandler({
        method: 'post',
        csrf: removeCsrf,
        endpoint: `${http_prefix}/lua/rest/v1/bind/host/pool/member.lua`,
        onModalShow: function () {
            $(`#remove-modal-feedback`).hide();
        },
        onModalInit: function () {
            $(`.remove-member-name`).html(`${memberRowData.name}`);
            $(`#remove-pool-name`).html(`<b>${selectedPool.name}</b>`);
        },
        beforeSumbit: function () {
            return { pool: defaultPoolId, member: memberRowData.member };
        },
        onSubmitSuccess: function (response, textStatus, modalHandler) {

            if (response.rc < 0) {
                $(`#remove-modal-feedback`).html(i18n.rest[response.rc_str]).fadeIn();
                return;
            }

            $hostMembersTable.ajax.reload();
            $(`#remove-member-host-pool`).modal('hide');
        }
    });

});