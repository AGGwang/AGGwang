Component({
    data: {
        value: 'pages/index/index',
    },
    methods: {
        onChange(e) {
            wx.switchTab({
                url: '/' + e.detail.value,
            });
        },
        init() {
            const page = getCurrentPages().pop();
            this.setData({
                value: page.route,
            });
        },
    },
});
